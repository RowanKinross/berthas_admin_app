import React, { useState, useEffect, useRef} from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/firebase'; 
import { isEqual } from 'lodash'; // Import deep comparison util

const DoughCalculator = () => {
  const [projections, setProjections] = useState({
    wed: 0,
    thurs: 0,
    fri: 0,
    sat: 0,
    sun: 0,
    wed_fw: 0,
  });

  const [leftover, setLeftover] = useState(0);
  const originalDataRef = useRef({ projections: {}, leftover: null });
  const [lastEdit, setLastEdit] = useState(null);

  // Calculations
  const currentWeekKeys = ['wed', 'thurs', 'fri', 'sat', 'sun'];
  const currentWeekTotal = currentWeekKeys.reduce((sum, key) => sum + (projections[key] || 0), 0);

  const totalProjected = Object.values(projections).reduce((a, b) => a + b, 0);
  const totalToMake = Math.max(totalProjected - leftover, 0);

  const thursdayBatch = 17;
  const tuesdayMakeAhead = Math.max(totalToMake - thursdayBatch, 0);

  useEffect(() => {
  const loadFromFirestore = async () => {
    const docRef = doc(db, 'doughPlans', 'currentWeek');
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data();
      if (data.projections) setProjections(data.projections);
      if (data.leftover !== undefined) setLeftover(data.leftover);
      if (data.updatedAt) setLastEdit(data.updatedAt.toDate());

      // Save original data for comparison later
      originalDataRef.current = {
        projections: data.projections || {},
        leftover: data.leftover ?? null,
      };
    }
  };

  loadFromFirestore();
}, []);

useEffect(() => {
  const timeout = setTimeout(() => {
    const currentData = {
      projections,
      leftover,
    };

    const original = originalDataRef.current;

    if (!isEqual(currentData, original)) {
      const saveToFirestore = async () => {
        const docRef = doc(db, 'doughPlans', 'currentWeek');
        await setDoc(docRef, {
          ...currentData,
          updatedAt: serverTimestamp(),
        });
        setLastEdit(new Date());
        originalDataRef.current = currentData; // update the original data
      };

      saveToFirestore();
    }
  }, 500);

  return () => clearTimeout(timeout);
}, [projections, leftover]);



  

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


  return (
    <div className='doughCalcWrapper'>
    <div className="calculatorContainer calcBlue">
      <h2>Restaurant</h2>
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
      <p><strong>Next Week:</strong></p>

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
                <p><strong>Following Week:</strong></p>
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
          <p>Make on Tuesday: <strong>{tuesdayMakeAhead}</strong> trays</p>

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


            <p>Make on Thursday: <strong>{thursdayBatch}</strong> trays<br /></p>
            <div className='ul'>
              <p className='paddingGeneral'> total flour: <strong> 30kg</strong></p>
              <div className='mixBreakdown'>
                <div className='redBlueContainer paddingGeneral'>
                  <p>mix breakdown: <strong className='paddingGeneral strong'> 30kg </strong> </p>
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
    <div className='calculatorContainer calcRed'>
      <h2>Frozen</h2>
    </div>
    </div>
  );
};

export default DoughCalculator;