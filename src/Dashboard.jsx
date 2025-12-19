import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { doc, onSnapshot, collection, getDocs, query, orderBy, limit, where } from "firebase/firestore";
import { db } from "./firebase";
import { useLanguage } from "./i18n/LanguageContext";

const CLASSES = ["car", "truck", "bus", "motorcycle", "person"];

const LABELS = {
  car: "Cars",
  truck: "Trucks",
  bus: "Buses",
  motorcycle: "Motorcycles",
  person: "Pedestrians",
};

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
function calculateWeightedTotal(counts) {
  const total = (Number(counts.car || 0) * 1.5) +
                (Number(counts.truck || 0) * 1) +
                (Number(counts.bus || 0) * 5) +
                (Number(counts.motorcycle || 0) * 1.5) +
                (Number(counts.person || 0) * 1);
  return Math.round(total);
}

function todayStrManaus() {
  // YYYY-MM-DD in America/Manaus (Manaus, Brazil)
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Manaus",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function currentMonthStrManaus() {
  // YYYY-MM in America/Manaus
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Manaus",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
}

function currentMonthNameManaus() {
  // Month name (e.g., "January", "February") in America/Manaus
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Manaus",
    month: "long",
  }).format(new Date());
}

function safe(obj, path, fallback = 0) {
  return path.split(".").reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), obj) ?? fallback;
}

export default function Dashboard() {
  const { t } = useLanguage();
  const siteId = "site-001";
  const cameraId = "usb-cam-1";

  const [latest, setLatest] = useState(null);
  const [todayAgg, setTodayAgg] = useState(null);
  const [monthlyAgg, setMonthlyAgg] = useState(null);
  const [dailyList, setDailyList] = useState([]); // last N days

  const dayId = useMemo(() => todayStrManaus(), []);
  const monthId = useMemo(() => currentMonthStrManaus(), []);
  const monthName = useMemo(() => currentMonthNameManaus(), []);

  // Dayparts with translations
  const DAYPARTS = useMemo(() => [
    { key: "morning", label: t("morning") },
    { key: "afternoon", label: t("afternoon") },
    { key: "evening", label: t("evening") },
    { key: "night", label: t("night") },
  ], [t]);

  useEffect(() => {
    console.log(`📊 Dashboard: Fetching data for siteId=${siteId}, cameraId=${cameraId}, dayId=${dayId}, monthId=${monthId}`);
    
    const camRef = doc(db, "sites", siteId, "cameras", cameraId);
    const unsub1 = onSnapshot(camRef, (snap) => {
      const data = snap.exists() ? snap.data()?.latest : null;
      console.log(`📡 Latest snapshot:`, data ? "✅ Data found" : "❌ No data");
      setLatest(data);
    }, (error) => {
      console.error("❌ Error fetching latest snapshot:", error);
    });

    const dayRef = doc(db, "sites", siteId, "cameras", cameraId, "daily", dayId);
    const unsub2 = onSnapshot(dayRef, (snap) => {
      const data = snap.exists() ? snap.data() : null;
      console.log(`📅 Daily aggregate (${dayId}):`, data ? "✅ Data found" : "❌ No data");
      setTodayAgg(data);
    }, (error) => {
      console.error("❌ Error fetching daily aggregate:", error);
    });

    const monthRef = doc(db, "sites", siteId, "cameras", cameraId, "monthly", monthId);
    const unsub3 = onSnapshot(monthRef, (snap) => {
      const data = snap.exists() ? snap.data() : null;
      console.log(`📆 Monthly aggregate (${monthId}):`, data ? "✅ Data found" : "❌ No data");
      setMonthlyAgg(data);
    }, (error) => {
      console.error("❌ Error fetching monthly aggregate:", error);
    });

    // load last 14 days (simple list; you can chart it later)
    (async () => {
      try {
        const q = query(
          collection(db, "sites", siteId, "cameras", cameraId, "daily"),
          orderBy("__name__", "desc"),
          limit(14)
        );
        const snap = await getDocs(q);
        console.log(`📋 Daily list query: Found ${snap.docs.length} documents`);
        const rows = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            totals: normalizeCounts(data.totals || {})
          };
        }).reverse();
        setDailyList(rows);
      } catch (error) {
        console.error("❌ Error fetching daily list:", error);
      }
    })();

    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [siteId, cameraId, dayId, monthId]);

  const liveCounts = normalizeCounts(latest?.counts);
  const liveTotal = Math.round(latest?.total ?? 0);

  // Use monthly aggregates instead of daily for the "Today Total" card
  // Normalize individual counts but preserve the total field (weighted impressions)
  const rawTotals = monthlyAgg?.totals || {};
  const totals = {
    ...normalizeCounts(rawTotals),
    total: rawTotals.total || 0  // Preserve the weighted total
  };
  
  // Normalize dayparts data, preserving the total field (weighted impressions)
  const dayparts = useMemo(() => {
    if (!todayAgg?.dayparts) return {};
    const normalized = {};
    Object.keys(todayAgg.dayparts).forEach((daypart) => {
      const rawDaypart = todayAgg.dayparts[daypart] || {};
      normalized[daypart] = {
        ...normalizeCounts(rawDaypart),
        total: rawDaypart.total || 0  // Preserve the weighted total for this daypart
      };
    });
    return normalized;
  }, [todayAgg?.dayparts]);
  
  // Helper to get class label (use LABELS, fallback to translation)
  const getClassLabel = (key) => LABELS[key] || t(key);

  // Advertising-friendly quick metrics
  const trafficMix = useMemo(() => {
    const veh = (totals.car || 0) + (totals.truck || 0) + (totals.bus || 0) + (totals.motorcycle || 0);
    const ped = totals.person || 0;
    const all = (totals.total || 0) || (veh + ped);
    return { veh, ped, all };
  }, [totals]);

  // Rider Analytics - Motorcycle + Person detection for delivery/commuter insights
  const riderAnalytics = useMemo(() => {
    const motorcycles = totals.motorcycle || 0;
    const persons = totals.person || 0;
    
    // Estimate riders: assume 30% of persons are motorcycle passengers
    const estimatedRiders = Math.min(motorcycles, Math.round(persons * 0.3));
    const soloRiders = motorcycles - estimatedRiders;
    const pedestrians = persons - estimatedRiders;
    
    return {
      totalMotorcycles: motorcycles,
      estimatedRiders,
      soloRiders,
      pedestrians,
      riderPercentage: motorcycles > 0 ? Math.round((estimatedRiders / motorcycles) * 100) : 0
    };
  }, [totals]);

  // Audience Profile - Socioeconomic proxy based on vehicle classification mix
  const audienceProfile = useMemo(() => {
    const totalVehicles = (totals.car || 0) + (totals.truck || 0) + 
                          (totals.bus || 0) + (totals.motorcycle || 0);
    
    if (totalVehicles === 0) return null;
    
    const busPercentage = Math.round((totals.bus / totalVehicles) * 100);
    const truckPercentage = Math.round((totals.truck / totalVehicles) * 100);
    const carPercentage = Math.round((totals.car / totalVehicles) * 100);
    const motorcyclePercentage = Math.round((totals.motorcycle / totalVehicles) * 100);
    
    // Determine audience profile
    let profile = t("mixedAudience");
    let targetRecommendation = t("massMarketProducts");
    
    if (busPercentage > 40) {
      profile = t("massTransitDominant");
      targetRecommendation = t("massMarketProducts");
    } else if (truckPercentage > 30) {
      profile = t("commercialIndustrial");
      targetRecommendation = t("b2bServices");
    } else if (carPercentage > 60) {
      profile = t("commuterMiddleIncome");
      targetRecommendation = t("consumerGoods");
    }
    
    return {
      profile,
      targetRecommendation,
      busPercentage,
      truckPercentage,
      carPercentage,
      motorcyclePercentage
    };
  }, [totals, t]);

  // Congestion Index & Dwell Time estimation - uses real data from backend
  const congestionIndex = useMemo(() => {
    // Get congestion data from daily aggregates (calculated by Cloud Function)
    const avgCongestion = todayAgg?.metrics?.avgCongestion || 0;
    const samples = todayAgg?.metrics?.congestionSamples || 1;
    const normalizedCongestion = avgCongestion / samples;
    
    // Fallback: estimate from current traffic if no backend data yet
    const fallbackScore = (trafficMix.veh * 10);
    const congestionScore = normalizedCongestion > 0 ? normalizedCongestion : fallbackScore;
    
    let status = t("lowCongestion");
    let color = "#51CF66";
    let dwellEstimate = t("dwellTimeLess30sec");
    let value = t("lowValue");
    
    if (congestionScore > 300) {
      status = t("highCongestion");
      color = "#FF6B6B";
      dwellEstimate = t("dwellTime2to5min");
      value = t("highValue");
    } else if (congestionScore > 150) {
      status = t("mediumCongestion");
      color = "#FFD700";
      dwellEstimate = t("dwellTime30to120sec");
      value = t("standardValue");
    }
    
    return { status, color, dwellEstimate, value, score: Math.round(congestionScore) };
  }, [todayAgg, trafficMix, t]);

  // Live Advertising Triggers - threshold-based alerts
  const [triggers, setTriggers] = useState([]);

  useEffect(() => {
    const checkTriggers = () => {
      const newTriggers = [];
      const recentWindow = latest?.counts || {};
      
      // Trigger 1: High bus count (transit spike)
      if (recentWindow.bus >= 3) {
        newTriggers.push({
          type: "HIGH_TRANSIT",
          message: t("highTransit"),
          action: t("triggerTransitAd"),
          priority: "high"
        });
      }
      
      // Trigger 2: Pedestrian spike (lunch rush)
      if (recentWindow.person >= 15) {
        newTriggers.push({
          type: "PEDESTRIAN_SPIKE",
          message: t("pedestrianSpike"),
          action: t("triggerRestaurantAd"),
          priority: "premium"
        });
      }
      
      // Trigger 3: High vehicle congestion
      const vehicles = (recentWindow.car || 0) + (recentWindow.truck || 0);
      if (vehicles >= 20) {
        newTriggers.push({
          type: "TRAFFIC_JAM",
          message: t("trafficJam"),
          action: t("triggerHighEngagementAd"),
          priority: "premium"
        });
      }
      
      setTriggers(newTriggers);
    };
    
    if (latest) {
      checkTriggers();
    }
  }, [latest, t]);

  // Share of Voice - mock data for concept demonstration
  const shareOfVoice = useMemo(() => {
    const totalImpressions = totals.total || 1;
    return [
      { brand: "Brand A", impressions: Math.round(totalImpressions * 0.4), percentage: 40, color: "#4C8EFF" },
      { brand: "Brand B", impressions: Math.round(totalImpressions * 0.35), percentage: 35, color: "#FFD700" },
      { brand: "Brand C", impressions: Math.round(totalImpressions * 0.25), percentage: 25, color: "#51CF66" }
    ];
  }, [totals]);
  
  // Check if we have any data at all
  const hasAnyData = latest !== null || todayAgg !== null || monthlyAgg !== null || dailyList.length > 0;

  return (
    <div style={{ padding: 20, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>{t("title")}</h1>
        <LanguageToggle />
      </div>
      <p>{t("site")}: <b>{siteId}</b> · {t("camera")}: <b>{cameraId}</b> · {t("today")}: <b>{dayId}</b></p>
      
      {!hasAnyData && (
        <div style={{ 
          padding: 20, 
          margin: "20px 0", 
          backgroundColor: "#1a1a1a", 
          border: "1px solid #444", 
          borderRadius: 8,
          color: "#ffa500"
        }}>
          <h3>⚠️ No Data Found</h3>
          <p>The dashboard is connected to Firebase, but no data has been found yet.</p>
          <p><strong>To get data:</strong></p>
          <ul style={{ marginLeft: 20 }}>
            <li>Make sure data is being sent to the staging Firebase project</li>
            <li>Check that the Cloud Function is deployed and receiving data</li>
            <li>Verify the siteId and cameraId match: <code>site-001</code> / <code>usb-cam-1</code></li>
            <li>Check browser console for connection status and errors</li>
          </ul>
          <p style={{ marginTop: 10, fontSize: "0.9em", opacity: 0.8 }}>
            Console logs will show: ✅ Data found or ❌ No data for each query
          </p>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(240px, 1fr))", gap: 12 }}>
        <Card title={t("liveWindow")}>
          <Big>{liveTotal}</Big>
          <Small>{t("impressions")} ({t("window")})</Small>
          <Hr />
          {CLASSES.map((k) => (
            <Row key={k} label={getClassLabel(k)} value={Math.round(liveCounts[k] || 0)} />
          ))}
        </Card>

        <Card title={`${t("totalOf")} ${monthName}`}>
          <Big>{Math.round(totals.total || 0)}</Big>
          <Small>{t("impressions")} ({t("today").toLowerCase()})</Small>
          <Hr />
          {CLASSES.map((k) => (
            <Row key={k} label={getClassLabel(k)} value={Math.round(totals[k] || 0)} />
          ))}
        </Card>

        <Card title={t("advertisingHighlights")}>
          <Row label={t("vehicleTraffic")} value={Math.round(trafficMix.veh)} />
          <Row label={t("pedestrianTraffic")} value={Math.round(trafficMix.ped)} />
          <Row label={t("trafficMixVeh")} value={trafficMix.all ? Math.round((trafficMix.veh / trafficMix.all) * 100) + "%" : "-"} />
          <Row label={t("trafficMixPed")} value={trafficMix.all ? Math.round((trafficMix.ped / trafficMix.all) * 100) + "%" : "-"} />
          <Hr />
          <Small>
            {t("useForPlacements")}
          </Small>
        </Card>
      </div>

      {/* Advanced OOH Analytics - Row 2 */}
      <h2 style={{ marginTop: 32, marginBottom: 16 }}>Advanced Audience & Engagement Analytics</h2>
      
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(240px, 1fr))", gap: 12, marginBottom: 20 }}>
        {/* Rider Analytics */}
        <Card title={t("riderAnalytics")}>
          <Row label={t("totalMotorcycles")} value={riderAnalytics.totalMotorcycles} />
          <Row label={t("estimatedRiders")} value={riderAnalytics.estimatedRiders} />
          <Row label={t("soloRiders")} value={riderAnalytics.soloRiders} />
          <Row label={t("riderPercentage")} value={`${riderAnalytics.riderPercentage}%`} />
          <Hr />
          <Small>{t("riderDesc")}</Small>
        </Card>

        {/* Audience Profile */}
        <Card title={t("audienceProfile")}>
          {audienceProfile ? (
            <>
              <Big style={{ fontSize: 24 }}>{audienceProfile.profile}</Big>
              <Small>{t("socioeconomicProxy")}</Small>
              <Hr />
              <Row label={t("publicTransit")} value={`${audienceProfile.busPercentage}%`} />
              <Row label={t("commercial")} value={`${audienceProfile.truckPercentage}%`} />
              <Row label={t("personalVehicles")} value={`${audienceProfile.carPercentage}%`} />
              <Hr />
              <Small><b>{t("targetAudience")}:</b> {audienceProfile.targetRecommendation}</Small>
            </>
          ) : (
            <Small>No vehicle data available</Small>
          )}
        </Card>

        {/* Congestion & Dwell Time */}
        <Card title={t("congestionDwellTime")}>
          <Big style={{ color: congestionIndex.color }}>{congestionIndex.status}</Big>
          <Small>{t("congestionIndex")}</Small>
          <Hr />
          <Row label={t("estDwellTime")} value={congestionIndex.dwellEstimate} />
          <Row label={t("adValue")} value={congestionIndex.value} />
          <Hr />
          <Small>{t("congestionDesc")}</Small>
        </Card>
      </div>

      {/* Live Advertising Triggers */}
      {triggers.length > 0 && (
        <Card title={t("liveAdvertisingTriggers")} style={{ 
          marginBottom: 20,
          background: "linear-gradient(135deg, #1a1a1a 0%, #2d1a1a 100%)",
          border: "2px solid #FF6B6B"
        }}>
          {triggers.map((trigger, i) => (
            <div key={i} style={{
              padding: 12,
              marginTop: i > 0 ? 12 : 0,
              background: "#2a1a1a",
              borderRadius: 8,
              borderLeft: `4px solid ${trigger.priority === 'premium' ? '#FF6B6B' : '#FFD700'}`
            }}>
              <div style={{ fontWeight: 700, color: "#FF6B6B" }}>{trigger.message}</div>
              <div style={{ fontSize: 12, marginTop: 4, opacity: 0.8 }}>
                → {trigger.action}
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Share of Voice & Store Attribution - Row 3 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 20 }}>
        {/* Share of Voice */}
        <Card title={t("shareOfVoice")}>
          <div style={{ marginBottom: 12 }}>
            <Small>{t("sovDesc")}</Small>
          </div>
          {shareOfVoice.map((brand, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span>{brand.brand}</span>
                <b>{brand.percentage}%</b>
              </div>
              <div style={{
                height: 8,
                background: "#333",
                borderRadius: 4,
                overflow: "hidden"
              }}>
                <div style={{
                  height: "100%",
                  width: `${brand.percentage}%`,
                  background: brand.color,
                  transition: "width 0.3s"
                }}></div>
              </div>
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                {brand.impressions.toLocaleString()} {t("brandImpressions")}
              </div>
            </div>
          ))}
        </Card>

        {/* Store Visit Attribution */}
        <Card title={t("storeVisitAttribution")}>
          <Small>{t("multiCameraFeature")}</Small>
          <Hr />
          <Row label={t("boardImpressions")} value={Math.round(totals.total || 0)} />
          <Row label={t("estStoreVisits")} value="—" />
          <Row label={t("attributionRate")} value="—" />
          <Hr />
          <Small>
            {t("storeVisitDesc")}
          </Small>
        </Card>
      </div>

      {/* Dynamic Pricing Section */}
      <DynamicPricingSectionMemo 
        dayparts={dayparts} 
        totals={totals} 
        cameraId={cameraId}
        siteId={siteId}
        t={t}
      />

      <h2 style={{ marginTop: 24 }}>{t("daypartBreakdown")}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(240px, 1fr))", gap: 12 }}>
        {DAYPARTS.map((dp) => {
          const daypartData = dayparts[dp.key] || {};
          return (
            <Card key={dp.key} title={dp.label}>
              <Big>{Math.round(daypartData.total || 0)}</Big>
              <Small>{t("impressions")}</Small>
              <Hr />
              {CLASSES.map((k) => (
                <Row key={k} label={getClassLabel(k)} value={Math.round(daypartData[k] || 0)} />
              ))}
            </Card>
          );
        })}
      </div>

      <h2 style={{ marginTop: 24 }}>{t("last14Days")}</h2>
      <div style={{ overflowX: "auto", border: "1px solid #333", borderRadius: 10, padding: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th>{t("date")}</th>
              <th>{t("total")}</th>
              {CLASSES.map((k) => <th key={k}>{getClassLabel(k)}</th>)}
            </tr>
          </thead>
          <tbody>
            {dailyList.map((d) => {
              // Calculate total as sum of all individual components (not weighted impressions)
              const totalSum = CLASSES.reduce((sum, k) => {
                return sum + Math.round(d.totals?.[k] || 0);
              }, 0);
              
              return (
                <tr key={d.id} style={{ borderTop: "1px solid #333" }}>
                  <td style={{ padding: "8px 0" }}><b>{d.id}</b></td>
                  <td>{totalSum}</td>
                  {CLASSES.map((k) => <td key={k}>{Math.round(d.totals?.[k] || 0)}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginTop: 24 }}>{t("whatMatters")}</h2>
      <ul>
        <li>{t("peakDaypart")}</li>
        <li>{t("trafficMixDesc")}</li>
        <li>{t("consistency")}</li>
        <li>{t("uptime")}</li>
        <li>{t("multiSite")}</li>
      </ul>
    </div>
  );
}

// Isolated Chart Components - only update when hourlyData changes
const TrafficVehiclesChart = React.memo(({ hourlyData, t }) => {
  const chartData = useMemo(() => {
    return hourlyData.map((d) => ({
      hour: d.hour,
      hourLabel: d.hourLabel,
      vehicles: d.vehicles,
      pedestrians: d.pedestrians,
      impressions: d.impressions,
    }));
  }, [hourlyData]);

  const vehiclesLine = useMemo(() => [
    { valueKey: "vehicles", color: "#4C8EFF", label: "Vehicles" },
  ], []);

  return (
    <LineChart
      data={chartData}
      yAxisLabel={t("trafficPerHour") + " - Vehicles"}
      lines={vehiclesLine}
      height={250}
    />
  );
}, (prevProps, nextProps) => {
  if (prevProps.hourlyData.length !== nextProps.hourlyData.length) return false;
  const dataChanged = prevProps.hourlyData.some((prev, i) => {
    const next = nextProps.hourlyData[i];
    if (!next) return true;
    return prev.vehicles !== next.vehicles || prev.hour !== next.hour;
  });
  return !dataChanged;
});

const TrafficPedestriansChart = React.memo(({ hourlyData, t }) => {
  const chartData = useMemo(() => {
    return hourlyData.map((d) => ({
      hour: d.hour,
      hourLabel: d.hourLabel,
      vehicles: d.vehicles,
      pedestrians: d.pedestrians,
      impressions: d.impressions,
    }));
  }, [hourlyData]);

  const pedestriansLine = useMemo(() => [
    { valueKey: "pedestrians", color: "#FFD700", label: "Pedestrians" },
  ], []);

  return (
    <LineChart
      data={chartData}
      yAxisLabel={t("trafficPerHour") + " - Pedestrians"}
      lines={pedestriansLine}
      height={250}
      yAxisTickStep={25}
    />
  );
}, (prevProps, nextProps) => {
  if (prevProps.hourlyData.length !== nextProps.hourlyData.length) return false;
  const dataChanged = prevProps.hourlyData.some((prev, i) => {
    const next = nextProps.hourlyData[i];
    if (!next) return true;
    return prev.pedestrians !== next.pedestrians || prev.hour !== next.hour;
  });
  return !dataChanged;
});

const ImpressionsChart = React.memo(({ hourlyData, t }) => {
  const chartData = useMemo(() => {
    return hourlyData.map((d) => ({
      hour: d.hour,
      hourLabel: d.hourLabel,
      vehicles: d.vehicles,
      pedestrians: d.pedestrians,
      impressions: d.impressions,
    }));
  }, [hourlyData]);

  const impressionsLine = useMemo(() => [
    { valueKey: "impressions", color: "#51CF66", label: "Impressions" },
  ], []);

  return (
    <LineChart
      data={chartData}
      yAxisLabel={t("impressionsPerHour")}
      lines={impressionsLine}
      height={250}
    />
  );
}, (prevProps, nextProps) => {
  if (prevProps.hourlyData.length !== nextProps.hourlyData.length) return false;
  const dataChanged = prevProps.hourlyData.some((prev, i) => {
    const next = nextProps.hourlyData[i];
    if (!next) return true;
    return prev.impressions !== next.impressions || prev.hour !== next.hour;
  });
  return !dataChanged;
});

const DynamicCPMChart = React.memo(({ hourlyData, cpmBase, cpmMultiplier, t }) => {
  const cpmChartData = useMemo(() => {
    return hourlyData.map((d) => {
      const impressionsPerHour = d.impressions || 0;
      const lowCPM = cpmBase * 0.8;
      const standardCPM = cpmBase;
      const premiumCPM = cpmBase + (cpmMultiplier * impressionsPerHour);
      
      return {
        ...d,
        lowCPM: Math.round(lowCPM * 100) / 100,
        standardCPM: Math.round(standardCPM * 100) / 100,
        premiumCPM: Math.round(premiumCPM * 100) / 100,
      };
    });
  }, [hourlyData, cpmBase, cpmMultiplier]);

  const cpmLines = useMemo(() => [
    { valueKey: "lowCPM", color: "#51CF66", label: "Low CPM" },
    { valueKey: "standardCPM", color: "#FFD700", label: "Standard CPM" },
    { valueKey: "premiumCPM", color: "#FF6B6B", label: "Premium CPM" },
  ], []);

  return (
    <>
      <LineChart
        data={cpmChartData}
        yAxisLabel={t("cpm")}
        lines={cpmLines}
        height={250}
      />
      <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 16, height: 16, background: "#51CF66", borderRadius: 2 }}></div>
          <span>{t("lowCPM")}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 16, height: 16, background: "#FFD700", borderRadius: 2 }}></div>
          <span>{t("standardCPM")}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 16, height: 16, background: "#FF6B6B", borderRadius: 2 }}></div>
          <span>{t("premiumCPM")}</span>
        </div>
      </div>
    </>
  );
}, (prevProps, nextProps) => {
  if (prevProps.hourlyData.length !== nextProps.hourlyData.length) return false;
  if (prevProps.cpmBase !== nextProps.cpmBase) return false;
  if (prevProps.cpmMultiplier !== nextProps.cpmMultiplier) return false;
  
  const dataChanged = prevProps.hourlyData.some((prev, i) => {
    const next = nextProps.hourlyData[i];
    if (!next) return true;
    return prev.impressions !== next.impressions || prev.hour !== next.hour;
  });
  return !dataChanged;
});

// Line Chart Component (responsive) - memoized to prevent flickering
const LineChart = React.memo(({ data, yAxisLabel, lines, height = 250, yAxisTickStep }) => {
    const containerRef = useRef(null);
    const [width, setWidth] = useState(400);

    // Measure container width on mount and resize - only update if changed
    useEffect(() => {
      const updateWidth = () => {
        if (containerRef.current) {
          const containerWidth = containerRef.current.offsetWidth;
          // Only update if width actually changed (prevents unnecessary re-renders)
          setWidth(prevWidth => {
            if (Math.abs(prevWidth - containerWidth) > 1) {
              return containerWidth;
            }
            return prevWidth;
          });
        }
      };

      // Use requestAnimationFrame to ensure DOM is ready
      const rafId = requestAnimationFrame(() => {
        updateWidth();
      });

      window.addEventListener('resize', updateWidth);
      return () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener('resize', updateWidth);
      };
    }, []);

    // Memoize chart calculations to prevent recalculation on every render
    const chartCalculations = useMemo(() => {
      const allValues = data.flatMap(d => lines.map(l => d[l.valueKey] || 0));
      const maxValue = Math.max(...allValues, 1);
      const padding = { top: 20, right: 40, bottom: 40, left: 60 };
      const chartHeight = height - padding.top - padding.bottom;
      const chartWidth = width - padding.left - padding.right;
      const stepX = chartWidth / Math.max(data.length - 1, 1);
      
      // Use custom tickStep if provided, otherwise calculate from maxValue
      let tickStep;
      let yTicks;
      if (yAxisTickStep !== undefined) {
        tickStep = yAxisTickStep;
        yTicks = Math.ceil(maxValue / tickStep);
        // Adjust maxValue to fit the tick step
        const adjustedMaxValue = yTicks * tickStep;
        return { maxValue: adjustedMaxValue, padding, chartHeight, stepX, yTicks, tickStep };
      } else {
        yTicks = 5;
        tickStep = maxValue / yTicks;
      }

      return { maxValue, padding, chartHeight, stepX, yTicks, tickStep };
    }, [data, lines, height, width, yAxisTickStep]);

    const { maxValue, padding, chartHeight, stepX, yTicks, tickStep } = chartCalculations;

    // Memoize points calculation for each line
    const linePoints = useMemo(() => {
      return lines.map((line) => {
        const points = data.map((d, i) => {
          const x = padding.left + i * stepX;
          const y = padding.top + chartHeight - ((d[line.valueKey] || 0) / maxValue) * chartHeight;
          return { x, y, value: d[line.valueKey] || 0 };
        });
        return { line, points };
      });
    }, [data, lines, padding, stepX, chartHeight, maxValue]);

    return (
      <div ref={containerRef} style={{ width: "100%", marginTop: 12 }}>
        <svg 
          width={width} 
          height={height} 
          style={{ 
            overflow: "visible", 
            display: "block"
          }}
        >
          {/* Y-axis label */}
          <text
            x={padding.left / 2}
            y={height / 2}
            fill="#999"
            fontSize={12}
            textAnchor="middle"
            transform={`rotate(-90, ${padding.left / 2}, ${height / 2})`}
          >
            {yAxisLabel}
          </text>

          {/* Y-axis ticks and grid lines */}
          {Array.from({ length: yTicks + 1 }).map((_, i) => {
            const value = i * tickStep;
            const y = padding.top + chartHeight - (value / maxValue) * chartHeight;
            return (
              <g key={`y-tick-${i}`}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#333"
                  strokeWidth={0.5}
                  strokeDasharray="2,2"
                  opacity={0.3}
                />
                <text
                  x={padding.left - 10}
                  y={y + 4}
                  fill="#999"
                  fontSize={10}
                  textAnchor="end"
                >
                  {Math.round(value)}
                </text>
              </g>
            );
          })}

          {/* X-axis */}
          <line
            x1={padding.left}
            y1={padding.top + chartHeight}
            x2={width - padding.right}
            y2={padding.top + chartHeight}
            stroke="#333"
            strokeWidth={1}
          />

          {/* Draw lines for each data series */}
          {linePoints.map(({ line, points }, lineIdx) => {
            // Draw the line
            const pathData = points.map((p, i) => 
              `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
            ).join(' ');

            return (
              <g key={`line-${lineIdx}-${line.valueKey}`}>
                <path
                  d={pathData}
                  fill="none"
                  stroke={line.color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Data points */}
                {points.map((p, i) => (
                  <circle
                    key={`point-${lineIdx}-${i}`}
                    cx={p.x}
                    cy={p.y}
                    r={4}
                    fill={line.color}
                    stroke="#0B0B0C"
                    strokeWidth={1}
                  />
                ))}
              </g>
            );
          })}

          {/* X-axis labels (every 2 hours) */}
          {data.map((d, i) => {
            if (i % 2 !== 0) return null; // Show every 2 hours
            const x = padding.left + i * stepX;
            return (
              <text
                key={`x-label-${i}`}
                x={x}
                y={height - padding.bottom + 20}
                fill="#999"
                fontSize={10}
                textAnchor="middle"
              >
                {d.hourLabel}
              </text>
            );
          })}
        </svg>
      </div>
    );
      }, (prevProps, nextProps) => {
    // Custom comparison function to prevent re-renders when data hasn't meaningfully changed
    if (prevProps.data.length !== nextProps.data.length) return false;
    if (prevProps.yAxisLabel !== nextProps.yAxisLabel) return false;
    if (prevProps.height !== nextProps.height) return false;
    if (prevProps.yAxisTickStep !== nextProps.yAxisTickStep) return false;
    if (prevProps.lines.length !== nextProps.lines.length) return false;
    
    // Compare lines array - check if it's the same reference first (fast path)
    if (prevProps.lines !== nextProps.lines) {
      const linesChanged = prevProps.lines.some((prevLine, i) => {
        const nextLine = nextProps.lines[i];
        if (!nextLine) return true;
        return prevLine.valueKey !== nextLine.valueKey || 
               prevLine.color !== nextLine.color ||
               prevLine.label !== nextLine.label;
      });
      if (linesChanged) return false;
    }
    
    // Create a simple hash of data values for quick comparison
    const createDataHash = (data, lines) => {
      return data.map(d => 
        lines.map(line => Math.round((d[line.valueKey] || 0) * 100)).join(',')
      ).join('|');
    };
    
    const prevHash = createDataHash(prevProps.data, prevProps.lines);
    const nextHash = createDataHash(nextProps.data, nextProps.lines);
    
    // Only re-render if hash changed (meaningful data change)
    return prevHash === nextHash;
  });

// Dynamic Pricing Section Component
function DynamicPricingSection({ dayparts, totals, cameraId, siteId, t }) {
  const [cpmBase, setCpmBase] = useState(10); // Base CPM in dollars
  const [cpmMultiplier, setCpmMultiplier] = useState(0.005); // k in CPM = base + k × traffic
  const [minImpressionsForPremium, setMinImpressionsForPremium] = useState(2000);
  const [viewabilityFactor, setViewabilityFactor] = useState(0.7); // 70% viewability
  const [hourlyData, setHourlyData] = useState([]);
  const [daypartsData, setDaypartsData] = useState({}); // Independent dayparts state for table
  
  // Fetch dayparts data independently for the pricing table
  useEffect(() => {
    const todayStr = todayStrManaus();
    const dayRef = doc(db, "sites", siteId, "cameras", cameraId, "daily", todayStr);
    
    const unsubscribe = onSnapshot(dayRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const dayparts = data.dayparts || {};
        // Normalize dayparts data
        const normalized = {};
        Object.keys(dayparts).forEach((daypart) => {
          const rawDaypart = dayparts[daypart] || {};
          normalized[daypart] = {
            ...normalizeCounts(rawDaypart),
            total: rawDaypart.total || 0
          };
        });
        setDaypartsData(normalized);
      } else {
        setDaypartsData({});
      }
    }, (error) => {
      console.error("Error fetching dayparts for pricing table:", error);
      setDaypartsData({});
    });
    
    return () => unsubscribe();
  }, [siteId, cameraId]);
  
  // Store dayparts in ref to avoid dependency issues (only used in fallback)
  const daypartsRef = useRef(dayparts);
  useEffect(() => {
    daypartsRef.current = dayparts;
  }, [dayparts]);

  // Generate hourly time slots: 4am to 1am next day (22 hours)
  const hourlySlots = useMemo(() => {
    const slots = [];
    // 4am to 11pm (20 hours)
    for (let h = 4; h < 24; h++) {
      slots.push(h);
    }
    // 12am and 1am next day (2 hours)
    slots.push(0, 1);
    return slots;
  }, []);

  // Format hour for display (e.g., 4 -> "4 AM", 14 -> "2 PM")
  const formatHour = useCallback((hour) => {
    if (hour === 0) return "12 AM";
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return "12 PM";
    return `${hour - 12} PM`;
  }, []);

  // Fallback: Estimate hourly data from daypart aggregates
  // Updated to match Cloud Function daypart periods: Morning (4-10), Afternoon (10-16), Evening (16-22), Night (22-4)
  const estimateHourlyFromDayparts = (dayparts, slots, formatHour) => {
    const daypartHours = {
      night: [22, 23, 0, 1, 2, 3], // 22-4 (6 hours, but we only show 22-1)
      morning: [4, 5, 6, 7, 8, 9], // 4-10 (6 hours)
      afternoon: [10, 11, 12, 13, 14, 15], // 10-16 (6 hours)
      evening: [16, 17, 18, 19, 20, 21], // 16-22 (6 hours)
    };

    return slots.map((hour) => {
      // Determine which daypart this hour belongs to (matching Cloud Function logic)
      let daypartKey = "night";
      if (hour >= 4 && hour < 10) daypartKey = "morning";
      else if (hour >= 10 && hour < 16) daypartKey = "afternoon";
      else if (hour >= 16 && hour < 22) daypartKey = "evening";
      // else: night (hour >= 22 || hour < 4)

      const daypartData = dayparts[daypartKey] || {};
      const hoursInDaypart = daypartHours[daypartKey] ? daypartHours[daypartKey].length : 6;
      
      const vehicles = Math.round(
        ((daypartData.car || 0) + (daypartData.truck || 0) + 
         (daypartData.bus || 0) + (daypartData.motorcycle || 0)) / hoursInDaypart
      );
      const pedestrians = Math.round((daypartData.person || 0) / hoursInDaypart);
      const impressions = Math.round((daypartData.total || 0) / hoursInDaypart);

      return {
        hour,
        hourLabel: formatHour(hour),
        vehicles,
        pedestrians,
        impressions,
        totalTraffic: vehicles + pedestrians,
      };
    });
  };

  // Fetch hourly data from hourly aggregates collection - OLAP optimization
  // Uses pre-aggregated data instead of scanning raw windows collection
  useEffect(() => {
    const fetchHourlyData = async () => {
      try {
        const now = new Date();
        const timeZone = "America/Manaus";
        
        // Get today's date in Manaus timezone
        const todayStr = new Intl.DateTimeFormat("en-CA", {
          timeZone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(now);

        // Query hourly aggregates collection (pre-aggregated, much faster)
        const hourlyRef = collection(
          db,
          "sites", siteId,
          "cameras", cameraId,
          "hourly"
        );

        let snapshot;
        try {
          // Try query with orderBy (requires composite index)
          const q = query(
            hourlyRef,
            where("dateStr", "==", todayStr),
            orderBy("hour", "asc")
          );
          snapshot = await getDocs(q);
        } catch (queryError) {
          // If query fails (index not ready or permission issue), try without orderBy
          console.warn("Query with orderBy failed, trying without orderBy:", queryError);
          try {
            const qSimple = query(
              hourlyRef,
              where("dateStr", "==", todayStr)
            );
            const simpleSnapshot = await getDocs(qSimple);
            // Sort manually if we got data
            if (!simpleSnapshot.empty) {
              const docs = simpleSnapshot.docs.sort((a, b) => {
                const hourA = a.data().hour || 0;
                const hourB = b.data().hour || 0;
                return hourA - hourB;
              });
              // Create a QuerySnapshot-like object with sorted docs
              snapshot = {
                forEach: (callback) => docs.forEach((doc) => callback(doc)),
                empty: docs.length === 0,
                size: docs.length,
                docs: docs
              };
            } else {
              snapshot = simpleSnapshot;
            }
          } catch (simpleError) {
            console.error("Both query attempts failed, using fallback:", simpleError);
            // If both queries fail, throw to trigger fallback to dayparts
            throw simpleError;
          }
        }
        const hourlyDataMap = {};
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          const hour = data.hour;
          const totals = data.totals || {};
          
          // Calculate vehicles (sum of car, truck, bus, motorcycle)
          const vehicles = (totals.car || 0) + (totals.truck || 0) + 
                          (totals.bus || 0) + (totals.motorcycle || 0);
          
          hourlyDataMap[hour] = {
            hour,
            hourLabel: formatHour(hour),
            vehicles: Math.round(vehicles),
            pedestrians: Math.round(totals.person || 0),
            impressions: Math.round(totals.total || 0),
            totalTraffic: Math.round(vehicles + (totals.person || 0)),
          };
        });

        // Check if we have any hourly data
        const hasHourlyData = Object.keys(hourlyDataMap).length > 0;
        
        if (hasHourlyData) {
          // Fill in missing hours with zeros (for hours with no data yet)
          const data = hourlySlots.map((hour) => {
            return hourlyDataMap[hour] || {
              hour,
              hourLabel: formatHour(hour),
              vehicles: 0,
              pedestrians: 0,
              impressions: 0,
              totalTraffic: 0,
            };
          });
          setHourlyData(data);
        } else {
          // No hourly data - use fallback from dayparts (use daypartsData which is independently fetched)
          console.log("No hourly aggregates found, using dayparts fallback");
          const fallbackData = estimateHourlyFromDayparts(daypartsData, hourlySlots, formatHour);
          setHourlyData(fallbackData);
        }
      } catch (error) {
        console.error("Error fetching hourly aggregates:", error);
        // Fallback: estimate from dayparts if hourly aggregates not available
        const fallbackData = estimateHourlyFromDayparts(daypartsData, hourlySlots, formatHour);
        setHourlyData(fallbackData);
      }
    };

    // Fetch immediately on mount
    fetchHourlyData();

    // Set up interval to fetch every hour (3600000 ms = 1 hour)
    const intervalId = setInterval(() => {
      fetchHourlyData();
    }, 3600000);

    // Cleanup interval on unmount
    return () => {
      clearInterval(intervalId);
    };
  }, [siteId, cameraId, hourlySlots, daypartsData, formatHour]); // Added daypartsData and formatHour to dependencies

  // Time bands mapping (using dayparts) - keep for table
  // Updated to match daypart hours: Morning Peak: 4am-10am, Afternoon Peak: 10am-4pm, 
  // Evening Peak: 4pm-10pm, Night: 10pm-4am
  const timeBands = useMemo(() => [
    { key: "morning", label: t("morning"), hours: "4:00–10:00", color: "#FFD700" }, // Yellow/Standard
    { key: "afternoon", label: t("afternoon"), hours: "10:00–16:00", color: "#FFD700" }, // Yellow/Standard
    { key: "evening", label: t("evening"), hours: "16:00–22:00", color: "#FF6B6B" }, // Red/Premium
    { key: "night", label: t("night"), hours: "22:00–4:00", color: "#51CF66" }, // Green/Low
  ], [t]);

  // Calculate pricing metrics for each time band (for table) - uses independent daypartsData
  const pricingData = useMemo(() => {
    return timeBands.map(band => {
      const daypartData = daypartsData[band.key] || {};
      const vehicles = (daypartData.car || 0) + (daypartData.truck || 0) + 
                      (daypartData.bus || 0) + (daypartData.motorcycle || 0);
      const pedestrians = daypartData.person || 0;
      const totalTraffic = vehicles + pedestrians;
      const impressions = Math.round(daypartData.total || 0);
      
      // Estimate hourly rates (assuming daypart spans multiple hours)
      // Morning Peak: 4am-10am (6 hours), Afternoon Peak: 10am-4pm (6 hours), 
      // Evening Peak: 4pm-10pm (6 hours), Night: 10pm-4am (6 hours)
      const hoursInBand = band.key === "morning" ? 6 : 
                         band.key === "afternoon" ? 6 : 
                         band.key === "evening" ? 6 : 6;
      const impressionsPerHour = Math.round(impressions / hoursInBand);
      const trafficPerHour = Math.round(totalTraffic / hoursInBand);
      
      // Calculate CPM: base + k × impressions_per_hour (consistent with chart)
      const cpm = cpmBase + (cpmMultiplier * impressionsPerHour);
      const cpt = impressionsPerHour > 0 ? (cpm * impressionsPerHour) / 1000 : 0;
      
      // Determine status based on impressions per hour (consistent with chart)
      let status = "Standard";
      let statusColor = "#FFD700";
      if (impressionsPerHour >= minImpressionsForPremium) {
        status = "Premium";
        statusColor = "#FF6B6B";
      } else if (impressionsPerHour < minImpressionsForPremium * 0.5) {
        status = "Low";
        statusColor = "#51CF66";
      }
      
      return {
        ...band,
        vehicles,
        pedestrians,
        totalTraffic,
        impressions,
        impressionsPerHour,
        trafficPerHour,
        cpm: Math.round(cpm * 100) / 100,
        cpt: Math.round(cpt * 100) / 100,
        status,
        statusColor,
        hoursInBand
      };
    });
  }, [daypartsData, timeBands, cpmBase, cpmMultiplier, minImpressionsForPremium]);

  return (
    <div style={{ marginTop: 32 }}>
      <h2 style={{ marginBottom: 16 }}>{t("dynamicPricing")}</h2>
      
      {/* Interactive Controls */}
      <Card title={t("pricingControls")} style={{ marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          <div>
            <label style={{ display: "block", marginBottom: 8, fontSize: 14 }}>
              {t("baseCPM")}: {cpmBase}
            </label>
            <input
              type="range"
              min="5"
              max="30"
              step="1"
              value={cpmBase}
              onChange={(e) => setCpmBase(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 8, fontSize: 14 }}>
              {t("cpmMultiplier")}: {cpmMultiplier.toFixed(4)}
            </label>
            <input
              type="range"
              min="0"
              max="0.02"
              step="0.0005"
              value={cpmMultiplier}
              onChange={(e) => setCpmMultiplier(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 8, fontSize: 14 }}>
              {t("minImpressionsPremium")}: {minImpressionsForPremium}
            </label>
            <input
              type="range"
              min="1000"
              max="5000"
              step="100"
              value={minImpressionsForPremium}
              onChange={(e) => setMinImpressionsForPremium(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 8, fontSize: 14 }}>
              {t("viewabilityFactor")}: {(viewabilityFactor * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0.5"
              max="1"
              step="0.05"
              value={viewabilityFactor}
              onChange={(e) => setViewabilityFactor(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>
          Formula: CPM = ${cpmBase} + {cpmMultiplier.toFixed(4)} × impressions
        </div>
      </Card>

      {/* Traffic per Hour Charts - Row 1: Vehicles and Pedestrians */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <Card title={t("trafficPerHour") + " - Vehicles"}>
          <TrafficVehiclesChart hourlyData={hourlyData} t={t} />
        </Card>
        <Card title={t("trafficPerHour") + " - Pedestrians"}>
          <TrafficPedestriansChart hourlyData={hourlyData} t={t} />
        </Card>
      </div>

      {/* Impressions and CPM Charts - Row 2 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <Card title={t("impressionsPerHour")}>
          <ImpressionsChart hourlyData={hourlyData} t={t} />
        </Card>
        <Card title={t("dynamicCPM")}>
          <DynamicCPMChart 
            hourlyData={hourlyData} 
            cpmBase={cpmBase} 
            cpmMultiplier={cpmMultiplier} 
            t={t} 
          />
        </Card>
      </div>

      {/* Inventory and Pricing Table */}
      <Card title={t("inventoryPricing")}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "2px solid #333" }}>
                <th style={{ padding: "12px 8px" }}>{t("screen")}</th>
                <th style={{ padding: "12px 8px" }}>{t("timeBand")}</th>
                <th style={{ padding: "12px 8px" }}>{t("avgTrafficHour")}</th>
                <th style={{ padding: "12px 8px" }}>{t("estImpressionsHour")}</th>
                <th style={{ padding: "12px 8px" }}>{t("cpm")}</th>
                <th style={{ padding: "12px 8px" }}>{t("cpt")}</th>
                <th style={{ padding: "12px 8px" }}>{t("status")}</th>
              </tr>
            </thead>
            <tbody>
              {pricingData.map((band, i) => (
                <tr key={band.key} style={{ borderTop: "1px solid #333" }}>
                  <td style={{ padding: "12px 8px" }}>{cameraId}</td>
                  <td style={{ padding: "12px 8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 12, height: 12, background: band.color, borderRadius: 2 }}></div>
                      <span>{band.hours}</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 8px" }}>{band.trafficPerHour.toLocaleString()}</td>
                  <td style={{ padding: "12px 8px" }}>{band.impressionsPerHour.toLocaleString()}</td>
                  <td style={{ padding: "12px 8px" }}>${band.cpm.toFixed(2)}</td>
                  <td style={{ padding: "12px 8px" }}>${band.cpt.toFixed(2)}</td>
                  <td style={{ padding: "12px 8px" }}>
                    <span style={{
                      padding: "4px 8px",
                      borderRadius: 4,
                      background: band.statusColor,
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 600
                    }}>
                      {t(band.status.toLowerCase())}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
  }

// Wrap DynamicPricingSection with React.memo to prevent re-renders from parent state
const DynamicPricingSectionMemo = React.memo(DynamicPricingSection, (prevProps, nextProps) => {
  // Only re-render if these specific props change (ignore dayparts/totals for chart isolation)
  // Charts are isolated and only depend on hourlyData which is internal state
  return prevProps.cameraId === nextProps.cameraId &&
         prevProps.siteId === nextProps.siteId &&
         prevProps.t === nextProps.t;
});
  
  function LanguageToggle() {
  const { language, switchLanguage } = useLanguage();

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button
        onClick={() => switchLanguage("en")}
        style={{
          padding: "8px 16px",
          border: language === "en" ? "2px solid #4C8EFF" : "1px solid #333",
          borderRadius: 8,
          background: language === "en" ? "#4C8EFF" : "transparent",
          color: language === "en" ? "#fff" : "#ededed",
          cursor: "pointer",
          fontWeight: language === "en" ? 600 : 400,
          transition: "all 0.2s",
        }}
      >
        English
      </button>
      <button
        onClick={() => switchLanguage("pt")}
        style={{
          padding: "8px 16px",
          border: language === "pt" ? "2px solid #4C8EFF" : "1px solid #333",
          borderRadius: 8,
          background: language === "pt" ? "#4C8EFF" : "transparent",
          color: language === "pt" ? "#fff" : "#ededed",
          cursor: "pointer",
          fontWeight: language === "pt" ? 600 : 400,
          transition: "all 0.2s",
        }}
      >
        Português
      </button>
    </div>
  );
}

function Card({ title, children, style }) {
  return (
    <div style={{ border: "1px solid #333", borderRadius: 12, padding: 14, ...style }}>
      <div style={{ fontWeight: 700, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}
function Big({ children }) {
  return <div style={{ fontSize: 42, fontWeight: 800, lineHeight: 1 }}>{children}</div>;
}
function Small({ children }) {
  return <div style={{ opacity: 0.8, marginTop: 6 }}>{children}</div>;
}
function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
      <span style={{ opacity: 0.9 }}>{label}</span>
      <b>{value}</b>
    </div>
  );
}
function Hr() {
  return <div style={{ height: 1, background: "#333", margin: "12px 0" }} />;
}
