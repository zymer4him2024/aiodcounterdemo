const functions = require("firebase-functions");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();

// Feed timeout: if no data received for this duration, reset impressions
const FEED_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes - adjust as needed

function getDateParts(tsMs, timeZone = "America/Los_Angeles") {
  const d = new Date(tsMs);

  // YYYY-MM-DD in the chosen timezone
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

  // hour 00-23 in the chosen timezone
  const hourStr = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hour12: false,
  }).format(d);
  const hour = Number(hourStr);

  // Dayparts:
  // Morning Peak: 4-10, Afternoon Peak: 10-16, Evening Peak: 16-22, Night: 22-4
  let daypart = "night";
  if (hour >= 4 && hour < 10) daypart = "morning";
  else if (hour >= 10 && hour < 16) daypart = "afternoon";
  else if (hour >= 16 && hour < 22) daypart = "evening";
  // else: night (hour >= 22 || hour < 4)

  return { dateStr, hour, daypart };
}

function getMonthParts(tsMs, timeZone = "America/Los_Angeles") {
  const d = new Date(tsMs);
  
  // YYYY-MM in the chosen timezone
  const monthStr = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).format(d);
  
  // Month name for display (e.g., "January", "February")
  const monthName = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "long",
  }).format(d);
  
  return { monthStr, monthName };
}

function normalizeCounts(raw = {}) {
  return {
    car: Number(raw.car ?? 0),
    truck: Number(raw.truck ?? 0),
    bus: Number(raw.bus ?? 0),
    motorcycle: Number(raw.motorcycle ?? raw.motorbike ?? 0),
    person: Number(raw.person ?? raw.pedestrian ?? 0),
  };
}

// Calculate weighted impressions: car*1.5 + truck*1 + bus*5 + motorcycle*1.5 + person*1
// Returns integer (rounded)
function calculateWeightedTotal(counts) {
  const safeNum = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
  const total = (safeNum(counts.car || 0) * 1.5) +
                (safeNum(counts.truck || 0) * 1) +
                (safeNum(counts.bus || 0) * 5) +
                (safeNum(counts.motorcycle || 0) * 1.5) +
                (safeNum(counts.person || 0) * 1);
  return Math.round(total);
}

exports.ingestCounts = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).send("POST only");

    // API key protection
    const apiKey = req.get("x-api-key") || "";
    const expected = (functions.config().counts && functions.config().counts.api_key) || "";
    if (!expected) return res.status(500).send("Missing functions config: counts.api_key");
    if (apiKey !== expected) return res.status(401).send("Invalid API key");

    const body = req.body || {};
    const siteId = body.siteId || "site-001";
    const cameraId = body.cameraId || "usb-cam-1";
    const ts = Number(body.ts || Date.now());
    const windowSec = Number(body.windowSec || 15);
    
    // Normalize counts to handle aliases (pedestrian -> person, motorbike -> motorcycle)
    const rawCounts = body.counts || {};
    const counts = normalizeCounts(rawCounts);
    
    // Always calculate weighted impressions from counts (ignore body.total if provided)
    // Formula: car*1.5 + truck*1 + bus*5 + motorcycle*1.5 + person*1
    const total = calculateWeightedTotal(counts);

    const db = admin.firestore();

    // --- Write raw window (history)
    const winRef = db
      .collection("sites").doc(siteId)
      .collection("cameras").doc(cameraId)
      .collection("windows").doc(String(ts));

    // --- Update latest snapshot for dashboard
    const camRef = db
      .collection("sites").doc(siteId)
      .collection("cameras").doc(cameraId);

    // --- Daily + daypart aggregates (NO scanning needed)
    const timeZone = "America/Manaus"; // Manaus, Brazil timezone
    const { dateStr, daypart, hour } = getDateParts(ts, timeZone);
    const { monthStr, monthName } = getMonthParts(ts, timeZone);

    const dayRef = camRef.collection("daily").doc(dateStr);
    const monthRef = camRef.collection("monthly").doc(monthStr);

    const inc = admin.firestore.FieldValue.increment;
    const safeNum = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);

    // Build increment map for each class
    const classKeys = ["car", "truck", "bus", "motorcycle", "person"];

    // Check if feed was stopped (last update was too long ago)
    let shouldReset = false;
    try {
      const camDoc = await camRef.get();
      if (camDoc.exists) {
        const latest = camDoc.data()?.latest;
        if (latest?.ts) {
          const timeSinceLastUpdate = ts - latest.ts;
          if (timeSinceLastUpdate > FEED_TIMEOUT_MS) {
            shouldReset = true;
            console.log(`Feed timeout detected: ${timeSinceLastUpdate}ms (${Math.round(timeSinceLastUpdate / 1000)}s) since last update. Resetting totals.`);
          } else {
            console.log(`Feed active: ${timeSinceLastUpdate}ms (${Math.round(timeSinceLastUpdate / 1000)}s) since last update. Incrementing totals.`);
          }
        } else {
          console.log("No previous timestamp found. First update of the day.");
        }
      } else {
        console.log("Camera document doesn't exist yet. First update.");
      }
    } catch (e) {
      console.error("Error checking feed status:", e);
      // Continue with normal flow if check fails
    }

    // Write window and camera snapshot in transaction
    await db.runTransaction(async (tx) => {
      // Write raw window (history)
      tx.set(winRef, {
        ts,
        windowSec,
        counts,
        total,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      // Update latest snapshot for dashboard
      tx.set(camRef, {
        latest: { ts, windowSec, counts, total },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    });

    // Handle daily aggregates separately (avoid transaction read/write ordering issues)
    if (shouldReset) {
      // Reset daily totals when feed was stopped
      const resetData = {
        timeZone,
        totals: {
          total: safeNum(total),
          car: safeNum(counts.car || 0),
          truck: safeNum(counts.truck || 0),
          bus: safeNum(counts.bus || 0),
          motorcycle: safeNum(counts.motorcycle || 0),
          person: safeNum(counts.person || 0)
        },
        dayparts: {
          morning: { total: 0, car: 0, truck: 0, bus: 0, motorcycle: 0, person: 0 },
          afternoon: { total: 0, car: 0, truck: 0, bus: 0, motorcycle: 0, person: 0 },
          evening: { total: 0, car: 0, truck: 0, bus: 0, motorcycle: 0, person: 0 },
          night: { total: 0, car: 0, truck: 0, bus: 0, motorcycle: 0, person: 0 }
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      // Set current daypart values
      resetData.dayparts[daypart] = {
        total: safeNum(total),
        car: safeNum(counts.car || 0),
        truck: safeNum(counts.truck || 0),
        bus: safeNum(counts.bus || 0),
        motorcycle: safeNum(counts.motorcycle || 0),
        person: safeNum(counts.person || 0)
      };
      await dayRef.set(resetData);
    } else {
      // Normal increment logic when feed is active
      // Use transaction to prevent race conditions when multiple requests arrive simultaneously
      await db.runTransaction(async (tx) => {
        // Read the daily document inside transaction
        const dayDoc = await tx.get(dayRef);
        
        // Get current data or initialize with zeros
        const currentData = dayDoc.exists ? dayDoc.data() : {
          totals: { total: 0, car: 0, truck: 0, bus: 0, motorcycle: 0, person: 0 },
          dayparts: {
            morning: { total: 0, car: 0, truck: 0, bus: 0, motorcycle: 0, person: 0 },
            afternoon: { total: 0, car: 0, truck: 0, bus: 0, motorcycle: 0, person: 0 },
            evening: { total: 0, car: 0, truck: 0, bus: 0, motorcycle: 0, person: 0 },
            night: { total: 0, car: 0, truck: 0, bus: 0, motorcycle: 0, person: 0 }
          }
        };
        
        // Calculate new totals by adding current + new values (all integers)
        const newTotals = {
          total: Math.round(safeNum(currentData.totals?.total || 0) + safeNum(total)),
          car: Math.round(safeNum(currentData.totals?.car || 0) + safeNum(counts.car || 0)),
          truck: Math.round(safeNum(currentData.totals?.truck || 0) + safeNum(counts.truck || 0)),
          bus: Math.round(safeNum(currentData.totals?.bus || 0) + safeNum(counts.bus || 0)),
          motorcycle: Math.round(safeNum(currentData.totals?.motorcycle || 0) + safeNum(counts.motorcycle || 0)),
          person: Math.round(safeNum(currentData.totals?.person || 0) + safeNum(counts.person || 0))
        };
        
        // Get current daypart data
        const currentDaypart = currentData.dayparts?.[daypart] || { total: 0, car: 0, truck: 0, bus: 0, motorcycle: 0, person: 0 };
        
        // Calculate new daypart totals (all integers)
        const newDaypart = {
          total: Math.round(safeNum(currentDaypart.total || 0) + safeNum(total)),
          car: Math.round(safeNum(currentDaypart.car || 0) + safeNum(counts.car || 0)),
          truck: Math.round(safeNum(currentDaypart.truck || 0) + safeNum(counts.truck || 0)),
          bus: Math.round(safeNum(currentDaypart.bus || 0) + safeNum(counts.bus || 0)),
          motorcycle: Math.round(safeNum(currentDaypart.motorcycle || 0) + safeNum(counts.motorcycle || 0)),
          person: Math.round(safeNum(currentDaypart.person || 0) + safeNum(counts.person || 0))
        };
        
        // Preserve other dayparts
        const newDayparts = {
          morning: currentData.dayparts?.morning || { total: 0, car: 0, truck: 0, bus: 0, motorcycle: 0, person: 0 },
          afternoon: currentData.dayparts?.afternoon || { total: 0, car: 0, truck: 0, bus: 0, motorcycle: 0, person: 0 },
          evening: currentData.dayparts?.evening || { total: 0, car: 0, truck: 0, bus: 0, motorcycle: 0, person: 0 },
          night: currentData.dayparts?.night || { total: 0, car: 0, truck: 0, bus: 0, motorcycle: 0, person: 0 }
        };
        
        // Update the current daypart
        newDayparts[daypart] = newDaypart;
        
        // Write the complete document inside transaction
        const newData = {
          timeZone,
          totals: newTotals,
          dayparts: newDayparts,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        console.log(`Transaction: old total=${currentData.totals?.total || 0}, new total=${newTotals.total}, daypart=${daypart}`);
        tx.set(dayRef, newData);
      });
      console.log("Successfully updated daily aggregates using transaction");
    }

    // Handle monthly aggregates - check if we need to reset for new month
    // First, check if we need to archive previous month (outside transaction)
    try {
      const monthDoc = await monthRef.get();
      const currentMonthData = monthDoc.exists ? monthDoc.data() : null;
      
      // Check if this is a new month (monthStr changed)
      const isNewMonth = !currentMonthData || currentMonthData.monthStr !== monthStr;
      
      if (isNewMonth && currentMonthData) {
        // Archive the previous month's data before resetting
        // Store it in a separate collection for historical access
        const archiveRef = camRef.collection("monthlyArchive").doc(currentMonthData.monthStr);
        await archiveRef.set({
          ...currentMonthData,
          archivedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`Archived month ${currentMonthData.monthStr} before resetting to ${monthStr}`);
      }
      
      // Now update monthly totals in transaction
      await db.runTransaction(async (tx) => {
        const monthDocTx = await tx.get(monthRef);
        const currentMonthDataTx = monthDocTx.exists ? monthDocTx.data() : null;
        const isNewMonthTx = !currentMonthDataTx || currentMonthDataTx.monthStr !== monthStr;
        
        if (isNewMonthTx) {
          // Reset monthly totals for new month
          const resetMonthData = {
            monthStr,
            monthName,
            timeZone,
            totals: {
              total: Math.round(safeNum(total)),
              car: safeNum(counts.car || 0),
              truck: safeNum(counts.truck || 0),
              bus: safeNum(counts.bus || 0),
              motorcycle: safeNum(counts.motorcycle || 0),
              person: safeNum(counts.person || 0)
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          };
          tx.set(monthRef, resetMonthData);
          console.log(`Reset monthly totals for new month: ${monthStr} (${monthName})`);
        } else {
          // Increment monthly totals
          const currentTotals = currentMonthDataTx.totals || {
            total: 0, car: 0, truck: 0, bus: 0, motorcycle: 0, person: 0
          };
          
          const newTotals = {
            total: Math.round(safeNum(currentTotals.total || 0) + safeNum(total)),
            car: Math.round(safeNum(currentTotals.car || 0) + safeNum(counts.car || 0)),
            truck: Math.round(safeNum(currentTotals.truck || 0) + safeNum(counts.truck || 0)),
            bus: Math.round(safeNum(currentTotals.bus || 0) + safeNum(counts.bus || 0)),
            motorcycle: Math.round(safeNum(currentTotals.motorcycle || 0) + safeNum(counts.motorcycle || 0)),
            person: Math.round(safeNum(currentTotals.person || 0) + safeNum(counts.person || 0))
          };
          
          tx.set(monthRef, {
            monthStr,
            monthName,
            timeZone,
            totals: newTotals,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
          
          console.log(`Updated monthly totals for ${monthStr}: total=${newTotals.total}`);
        }
      });
    } catch (e) {
      console.error("Error updating monthly aggregates:", e);
      // Continue even if monthly update fails
    }

    // Handle hourly aggregates - pre-aggregate for dashboard queries
    try {
      const hourStr = String(hour).padStart(2, '0');
      const hourId = `${dateStr}_${hourStr}`;
      const hourRef = camRef.collection("hourly").doc(hourId);

      await db.runTransaction(async (tx) => {
        const hourDoc = await tx.get(hourRef);
        const currentHourData = hourDoc.exists ? hourDoc.data() : {
          dateStr,
          hour,
          totals: { total: 0, car: 0, truck: 0, bus: 0, motorcycle: 0, person: 0 }
        };
        
        const newTotals = {
          total: Math.round(safeNum(currentHourData.totals?.total || 0) + safeNum(total)),
          car: Math.round(safeNum(currentHourData.totals?.car || 0) + safeNum(counts.car || 0)),
          truck: Math.round(safeNum(currentHourData.totals?.truck || 0) + safeNum(counts.truck || 0)),
          bus: Math.round(safeNum(currentHourData.totals?.bus || 0) + safeNum(counts.bus || 0)),
          motorcycle: Math.round(safeNum(currentHourData.totals?.motorcycle || 0) + safeNum(counts.motorcycle || 0)),
          person: Math.round(safeNum(currentHourData.totals?.person || 0) + safeNum(counts.person || 0))
        };
        
        tx.set(hourRef, {
          dateStr,
          hour,
          timeZone,
          totals: newTotals,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      });
      console.log(`Updated hourly aggregate for ${hourId}: hour=${hour}`);
    } catch (e) {
      console.error("Error updating hourly aggregates:", e);
      // Continue even if hourly update fails
    }

    return res.status(200).json({ ok: true, dateStr, daypart, monthStr, reset: shouldReset });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
});
