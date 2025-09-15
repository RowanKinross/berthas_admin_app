import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, getDocs, collection, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { isEqual } from 'lodash';

const DoughCalculator = ({ selectedYearWeek, getWeekYear}) => {
  const [projections, setProjections] = useState({});
  const [leftover, setLeftover] = useState(0);
  const [thursdayMixSize, setThursdayMixSize] = useState(30);
  const [lastEdit, setLastEdit] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const originalDataRef = useRef({});
  const userRole = localStorage.getItem('userRole');

  // Helper to get previous week
  function getPrevYearWeek({ year, week }) {
    if (week > 1) return { year, week: week - 1 };
    // Handle year wrap
    const lastYear = year - 1;
    const lastWeek = 52; // You may want to calculate the actual last week of the year
    return { year: lastYear, week: lastWeek };
  }

  // Load logic
  useEffect(() => {
    if (!selectedYearWeek) return;
    setLoaded(false);

    const loadWeek = async () => {
      const { year, week } = selectedYearWeek;
      const docRef = doc(db, 'prepStatus', `${year}-W${week}`);
      const snap = await getDoc(docRef);

      if (snap.exists() && snap.data().dough) {
        const data = snap.data().dough;
        setProjections(data.projections || {});
        setLeftover(data.leftover ?? 0);
        setThursdayMixSize(data.thursdayMixSize ?? 30);
        setLastEdit(data.updatedAt ? data.updatedAt.toDate() : null);
        originalDataRef.current = {
          projections: data.projections || {},
          leftover: data.leftover ?? 0,
          thursdayMixSize: data.thursdayMixSize ?? 30,
        };
        setLoaded(true);
      } else {
        // Try to load last week's data
        const prev = getPrevYearWeek({ year, week });
        const prevDocRef = doc(db, 'prepStatus', `${prev.year}-W${prev.week}`);
        const prevSnap = await getDoc(prevDocRef);
        if (prevSnap.exists() && prevSnap.data().dough) {
          const prevData = prevSnap.data().dough;
          setProjections(prevData.projections || {});
          setLeftover(prevData.leftover ?? 0);
          setThursdayMixSize(prevData.thursdayMixSize ?? 30);
          setLastEdit(prevData.updatedAt ? prevData.updatedAt.toDate() : null);
          originalDataRef.current = {
            projections: prevData.projections || {},
            leftover: prevData.leftover ?? 0,
            thursdayMixSize: prevData.thursdayMixSize ?? 30,
          };
        } else {
          // No data at all, just use defaults (but do NOT reset to 0 on week change)
          setProjections({});
          setLeftover(0);
          setThursdayMixSize(30);
          setLastEdit(null);
          originalDataRef.current = {
            projections: {},
            leftover: 0,
            thursdayMixSize: 30,
          };
        }
        setLoaded(true);
      }
    };

    loadWeek();
  }, [selectedYearWeek]);

  // Save logic
  useEffect(() => {
    if (!loaded || !selectedYearWeek) return;

    const currentData = { projections, leftover, thursdayMixSize };
    const original = originalDataRef.current;

    if (!isEqual(currentData, original)) {
      const timeout = setTimeout(() => {
        const { year, week } = selectedYearWeek;
        const docRef = doc(db, 'prepStatus', `${year}-W${week}`);
        setDoc(docRef, {
          dough: {
            ...currentData,
            updatedAt: serverTimestamp(),
          }
        }, { merge: true });
        setLastEdit(new Date());
        originalDataRef.current = currentData;
      }, 500);

      return () => clearTimeout(timeout);
    }
  }, [projections, leftover, thursdayMixSize, loaded, selectedYearWeek]);

  // Calculations
  const currentWeekKeys = ['wed', 'thurs', 'fri', 'sat', 'sun'];
  const currentWeekTotal = currentWeekKeys.reduce((sum, key) => sum + (projections[key] || 0), 0);

  const totalProjected = Object.values(projections).reduce((a, b) => a + b, 0);
  const totalToMake = Math.max(totalProjected - leftover, 0);

  const traysPerKg = 17 / 30; 
  const thursdayBatch = Math.round(thursdayMixSize * traysPerKg);
  const tuesdayMakeAhead = Math.max(totalToMake - thursdayBatch, 0);

  // Labels
  const dayLabels = {
    wed: 'Wednesday',
    thurs: 'Thursday',
    fri: 'Friday',
    sat: 'Saturday',
    sun: '(Sunday)',
    wed_fw: 'Wednesday',
  };
  const orderedDays = ['wed', 'thurs', 'fri', 'sat', 'sun', 'wed_fw'];

  // Handler
  const handleChange = (e) => {
    const { name, value } = e.target;
    setProjections((prev) => ({
      ...prev,
      [name]: Number(value),
    }));
  };

  const getTuesdayMixPlan = (trayCount) => {
    const kgPerTray = 5 / 2.78;
    const exactKg = trayCount * kgPerTray;

    const mixBlocks = trayCount / 2.78;
    const roundedKg = Math.round(mixBlocks) * 5; // closest multiple of 5

    const mixSizes = [50, 45, 35, 30, 15];
    const memo = {};

    const helper = (remaining) => {
      if (remaining === 0) return [[]];
      if (remaining < 0) return [];
      if (memo[remaining]) return memo[remaining];

      let plans = [];

      for (let size of mixSizes) {
        const subplans = helper(remaining - size);
        for (let plan of subplans) {
          plans.push([size, ...plan]);
        }
      }

      memo[remaining] = plans;
      return plans;
    };

    const allPlans = helper(roundedKg);

    if (allPlans.length === 0) {
      return {
        kgNeeded: Math.round(exactKg),
        roundedKg,
        mixPlan: [],
      };
    }

    // Pick shortest plan
    let bestPlan = allPlans.reduce((best, plan) =>
      !best || plan.length < best.length ? plan : best,
      null
    );

    return {
      kgNeeded: Math.round(exactKg),
      roundedKg,
      mixPlan: bestPlan,
    };
  };

  const { kgNeeded, roundedKg, mixPlan } = getTuesdayMixPlan(tuesdayMakeAhead);

  // --- Add this state and effect to fetch batches ---
  const [batches, setBatches] = useState([]);

  useEffect(() => {
    if (!selectedYearWeek) return;
    const fetchBatches = async () => {
      const batchSnap = await getDocs(collection(db, "batches"));
      const allBatches = batchSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Use selectedYearWeek, not today's week
      const { year: thisYear, week: thisWeek } = selectedYearWeek;
      const weekBatches = allBatches.filter(batch => {
        if (!batch.batch_date) return false;
        const batchDate = new Date(batch.batch_date);
        const { year, week } = getWeekYear(batchDate);
        return year === thisYear && week === thisWeek;
      });

      setBatches(weekBatches);
    };
    fetchBatches();
  }, [selectedYearWeek, getWeekYear]);

  // --- Calculate frozen pizza numbers ---
  const totalFrozenPizzas = batches.reduce((sum, batch) => {
    return sum + (batch.pizzas || []).reduce((pSum, pizza) => pSum + (pizza.quantity || 0), 0);
  }, 0);

  const frozenWith10Percent = Math.ceil(totalFrozenPizzas * 1.1);

  // 50kg flour mix yields 314 pizzas
  const pizzasPerMix = 314;
  const mixCount = frozenWith10Percent > 0 ? Math.ceil(frozenWith10Percent / pizzasPerMix) : 0;
  const flourNeeded = mixCount * 50; // kg

  // --- Frozen Section ---
  

  // Helper for frozen mix plan (denominations and yields)
const frozenMixSizes = [50, 45, 35, 30, 15];
const frozenMixYields = {
  50: 314,
  45: 282,
  35: 220,
  30: 188,
  15: 94,
};

// Calculate frozen mix plan (greedy, largest first)
function getFrozenMixPlan(pizzaTarget) {
  const minTarget = pizzaTarget - 12;
  const mixSizes = [50, 45, 35, 30, 15];
  const mixYields = { 50: 314, 45: 282, 35: 220, 30: 188, 15: 94 };

  // Limit search depth to avoid infinite loops
  const MAX_MIXES = 10;
  let best = null;

  function search(plan, totalBalls, totalFlour) {
    if (plan.length > MAX_MIXES) return;
    if (totalBalls >= minTarget) {
      // If this plan is closer (but not under minTarget), or uses fewer mixes, use it
      if (
        !best ||
        totalBalls < best.totalBalls ||
        (totalBalls === best.totalBalls && plan.length < best.plan.length)
      ) {
        best = { plan: [...plan], totalBalls, totalFlour };
      }
      return;
    }
    for (let size of mixSizes) {
      search(
        [...plan, size],
        totalBalls + mixYields[size],
        totalFlour + size
      );
    }
  }

  search([], 0, 0);

  // If no plan found (shouldn't happen), fallback to greedy
  if (!best) {
    let totalBalls = 0;
    let totalFlour = 0;
    const plan = [];
    while (pizzaTarget - totalBalls > 12) {
      const needed = pizzaTarget - totalBalls;
      const possible = mixSizes.filter(size => mixYields[size] >= needed);
      if (possible.length > 0) {
        const smallest = possible[possible.length - 1];
        plan.push(smallest);
        totalBalls += mixYields[smallest];
        totalFlour += smallest;
        break;
      } else {
        const largest = mixSizes[0];
        plan.push(largest);
        totalBalls += mixYields[largest];
        totalFlour += largest;
      }
    }
    best = { plan, totalBalls, totalFlour };
  }

  return best;
}

const frozenPlan = getFrozenMixPlan(frozenWith10Percent);

  return (
    <div className='doughCalcWrapper'>
    <div className="calculatorContainer calcBlue">
      <h2 className='doughHeader'>Restaurant:</h2>
      {userRole === 'unit' ? (
        <div className="sub-result">
          <p><strong>Tuesday:</strong></p>
          {mixPlan.length > 0 ? (
            <div className='ul'>
              <div className='mixBreakdown'>
                <div className='redBlueContainer paddingGeneral'>
                  <p>mix: <strong className='paddingGeneral strong'> {mixPlan.join('kg  + ')}kg </strong> </p>
                </div>  
                <div className='redBlueContainer paddingGeneral' >
                  <p>- all caputo </p>
                  <p className="text-blue">blue</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="warning">
              ⚠️ No valid mix plan for {kgNeeded}kg. Try adjusting trays slightly.
            </p>
          )}




          <p><strong>Thursday:</strong><br /></p>
          <div className='ul'>
            <div className='mixBreakdown'>
              <div className='redBlueContainer paddingGeneral'>
                <p>mix: <strong className='paddingGeneral strong'> {thursdayMixSize}kg </strong> </p>
              </div>  
              <div className='redBlueContainer paddingGeneral' >
                <p> - half caputo </p>
                <p className="text-red"> red</p>
                <p>/ half</p>
                <p className="text-blue">blue</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {lastEdit && (
            <p className="last-edit">
              Last edit: {lastEdit.toLocaleString('en-GB')}
            </p>
          )}

          {/* Leftover input */}
          <div className="input-row">
            <label>Leftover from last week:</label>
            <input
              type="number"
              min="0"
              value={leftover || ''}
              onChange={(e) => setLeftover(Number(e.target.value))}
            />
          </div>

          <hr className="dotted-divider" />
          <p><strong>Week Ahead:</strong></p>

          {/* Dough projections */}
          <div className="inputs-section">
            {orderedDays.map((day) => (
              <React.Fragment key={day}>
                <div className="input-row">
                  <label>{dayLabels[day]}</label>
                  <input
                    type="number"
                    name={day}
                    min="0"
                    value={projections[day] || ''}
                    onChange={handleChange}
                  />
                </div>
                {day === 'sun' && (
                  <>
                    <div className="tray-subtotal">
                      Week subtotal: <strong>{currentWeekTotal}</strong> trays
                    </div>
                    <hr className="dotted-divider" />
                    <p><strong>Next Week:</strong></p>
                  </>
                )}
              </React.Fragment>
            ))}
          </div>
          <hr className="dotted-divider" />

          {/* Final result */}
          <div className="result">
            <p>Total to make:</p>
            <span>{totalToMake} trays</span>
            <div className="sub-result">
              <p>Make on<strong> Tuesday:</strong> {tuesdayMakeAhead} trays</p>
              {mixPlan.length > 0 ? (
                <div className='ul'>
                  <p className='paddingGeneral'>total flour: <strong>{roundedKg}kg</strong></p>
                  <div className='mixBreakdown'>
                    <div className='redBlueContainer paddingGeneral'>
                      <p>mix breakdown: <strong className='paddingGeneral strong'> {mixPlan.join('kg  + ')}kg </strong> </p>
                    </div>  
                    <div className='redBlueContainer paddingGeneral' >
                      <p>- all caputo </p>
                      <p className="text-blue">blue</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="warning">
                  ⚠️ No valid mix plan for {kgNeeded}kg. Try adjusting trays slightly.
                </p>
              )}
              <div>
    <label>
      <p>Make on <strong>Thursday:</strong> {totalToMake - tuesdayMakeAhead} trays </p>
      <select
        value={thursdayMixSize}
        onChange={e => setThursdayMixSize(Number(e.target.value))}
        style={{ marginLeft: 8, marginRight: 8 }}
      >
        {[15, 30, 35, 45, 50].map(size => (
          <option key={size} value={size}>{size}kg</option>
        ))}
      </select>
        </label>
        <div className='ul'>
          <div className='mixBreakdown'>
            <div className='redBlueContainer paddingGeneral'>
              <p>mix: <strong className='paddingGeneral strong'> {thursdayMixSize}kg </strong> </p>
            </div>  
            <div className='redBlueContainer paddingGeneral' >
              <p> - half caputo </p>
              <p className="text-red"> red</p>
              <p>/ half</p>
              <p className="text-blue">blue</p>
            </div>
          </div>
        </div>
      </div>
            </div>
          </div>
        </>
      )}
    </div>
    <div className='calculatorContainer calcRed'>
      <h2 className='doughHeader'>Frozen:</h2>
      {userRole === 'unit' ? (
      <div className="result">
        <div className="sub-result paddingGeneral">
          <p><strong>Tuesday:</strong></p>
          <div className='ul'>
            <div className='mixBreakdown'>
              <div className='redBlueContainer paddingGeneral'>
                <p>
                  mixes:
                  <strong className='paddingGeneral strong'>
                    {frozenPlan.plan.map((kg, i) => (
                      <span key={i}>
                        {kg}kg 
                        {i < frozenPlan.plan.length - 1 ? ' + ' : ''}
                      </span>
                    ))}
                  </strong>
                </p>
              </div>
              <div className='redBlueContainer paddingGeneral'>
                <p>- all caputo</p>
                <p className="text-red">red</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    ) : (
      <>
    <br/>
    <p><strong>Week Ahead:</strong></p>
    <div className="inputs-section">
      <div className="input-row">
        <label>Total pizzas this week:</label>
        <span><strong>{totalFrozenPizzas}</strong></span>
      </div>
      <div className="input-row">
        <label>+10% buffer:</label>
        <span><strong>{frozenWith10Percent}</strong></span>
      </div>
    </div>
    <hr className="dotted-divider" />
    <div className="result">
      <div className="sub-result paddingGeneral">
        <p>Make on <strong>Tuesday:</strong>~{frozenWith10Percent} dough balls</p>
        <div className='ul'>
          <p className='paddingGeneral'>total flour: <strong>{frozenPlan.totalFlour}kg</strong></p>
          <p className='paddingGeneral'> (makes {frozenPlan.totalBalls} dough balls)</p>
          <div className='mixBreakdown'>
            <div className='redBlueContainer '>
              <p>
                mix breakdown:
                <strong className=' strong'>
                  {frozenPlan.plan.map((kg, i) => (
                    <span key={i}>
                      {kg}kg 
                      {i < frozenPlan.plan.length - 1 ? ' + ' : ''}
                    </span>
                  ))}
                </strong>
              </p>
            </div>
            <div className='redBlueContainer paddingGeneral'>
              <p>- all caputo</p>
              <p className="text-red">red</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </>
)}
    </div>
    </div>
  );
};

export default DoughCalculator;