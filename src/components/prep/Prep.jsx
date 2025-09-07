// import berthasLogo from '../bertha_logo'
import './prep.css'
import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons';
import { db } from '../firebase/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';

function getWeekYear(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diffToSaturday = (day + 1) % 7;
  d.setDate(d.getDate() - diffToSaturday);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const yearStartDay = yearStart.getDay();
  const firstSaturday =
    yearStartDay === 6
      ? yearStart
      : new Date(yearStart.setDate(yearStart.getDate() + ((6 - yearStartDay + 7) % 7)));
  const week = Math.floor((d - firstSaturday) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return { year: d.getFullYear(), week };
}

const parseIngredientRatio = (ratioString) => {
  const [gramsPerPizza, unitWeight] = ratioString.split(':').map(part => part.trim());
  return {
    gramsPerPizza: parseFloat(gramsPerPizza),
    unitWeight: parseFloat(unitWeight)
  };
};

// Add this function in your file (outside your component)
function getOrdinalDay(date) {
  const day = date.getDate();
  if (day > 3 && day < 21) return day + 'th';
  switch (day % 10) {
    case 1:  return day + 'st';
    case 2:  return day + 'nd';
    case 3:  return day + 'rd';
    default: return day + 'th';
  }
}

// Helper to get the correct "week commencing" Monday
function getCurrentOrNextMonday(date = new Date()) {
  const day = date.getDay();
  const monday = new Date(date);
  if (day === 6) {
    // Saturday: add 2 days
    monday.setDate(date.getDate() + 2);
  } else if (day === 0) {
    // Sunday: add 1 day
    monday.setDate(date.getDate() + 1);
  } else {
    // Monday-Friday: subtract (day - 1) days to get this week's Monday
    monday.setDate(date.getDate() - (day - 1));
  }
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// Helper to get a weekday date relative to a given Monday
function getRelativeWeekdayDate(monday, weekday) {
  // weekday: 1=Monday, 2=Tuesday, ..., 7=Sunday
  const date = new Date(monday);
  date.setDate(monday.getDate() + (weekday - 1));
  return date;
}

function Prep() {
  const [batches, setBatches] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ingredientTotals, setIngredientTotals] = useState([]);
  const [checkedIngredients, setCheckedIngredients] = useState({});
  const [openNote, setOpenNote] = useState(null); // Add this line

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const batchSnap = await getDocs(collection(db, "batches"));
      const ingredientSnap = await getDocs(collection(db, "ingredients"));
      const batchesData = batchSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const ingredientsData = ingredientSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBatches(batchesData);
      setIngredients(ingredientsData);
      setLoading(false);
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!batches.length || !ingredients.length) return;

    // Get this week's batches (Sat-Fri)
    const today = new Date();
    const { year: thisYear, week: thisWeek } = getWeekYear(today);
    const weekBatches = batches.filter(batch => {
      if (!batch.batch_date) return false;
      const batchDate = new Date(batch.batch_date);
      const { year, week } = getWeekYear(batchDate);
      return year === thisYear && week === thisWeek;
    });

    // Amalgamate all pizzas
    const allPizzas = weekBatches.flatMap(batch => batch.pizzas || []);

    // Calculate ingredient totals
    const ingredientQuantities = {};
    allPizzas.forEach(pizza => {
      (pizza.ingredients || []).forEach(ingredientName => {
        const ingredientData = ingredients.find(ing => ing.name === ingredientName);
        if (ingredientData) {
          const { gramsPerPizza, unitWeight } = parseIngredientRatio(ingredientData.ratio);
          if (!ingredientQuantities[ingredientData.name]) {
            ingredientQuantities[ingredientData.name] = {
              quantity: 0,
              unit: ingredientData.packaging,
              unitWeight
            };
          }
          ingredientQuantities[ingredientData.name].quantity += (gramsPerPizza * (pizza.quantity || 0));
        }
      });
    });

    // Convert to kg and calculate units needed
    Object.keys(ingredientQuantities).forEach(ingredient => {
      const data = ingredientQuantities[ingredient];
      data.quantity = data.quantity / 1000; // grams to kg
      // Round unitsNeeded to 1 decimal place
      data.unitsNeeded = data.unitWeight ? Math.round((data.quantity / data.unitWeight) * 10) / 10 : 0;
    });

    setIngredientTotals(Object.entries(ingredientQuantities).map(([name, data]) => ({
      name,
      ...data
    })));
  }, [batches, ingredients]);


  // Get this week's Saturday date
  const today = new Date();
  const day = today.getDay();
  const diffToSaturday = (day + 1) % 7;
  const saturday = new Date(today);
  saturday.setDate(today.getDate() - diffToSaturday);


  // Helper to get all pizzas for a given date
  const getPizzasForDate = (date) => {
    return batches
      .filter(batch => {
        if (!batch.batch_date) return false;
        const batchDate = new Date(batch.batch_date);
        return (
          batchDate.getFullYear() === date.getFullYear() &&
          batchDate.getMonth() === date.getMonth() &&
          batchDate.getDate() === date.getDate()
        );
      })
      .flatMap(batch => batch.pizzas || []);
  };

  // Helper to get total tomato needed for a given date
  const getTomatoPrepForDate = (date) => {
    const pizzas = getPizzasForDate(date);
    const tomatoData = ingredients.find(i => i.name.toLowerCase() === "tomato");
    if (!tomatoData) return null;
    const { gramsPerPizza, unitWeight } = parseIngredientRatio(tomatoData.ratio);
    let totalGrams = 0;
    pizzas.forEach(pizza => {
      if ((pizza.ingredients || []).includes("Tomato")) {
        totalGrams += gramsPerPizza * (pizza.quantity || 0);
      }
    });
    const totalKg = totalGrams / 1000;
    // Round unitsNeeded to 1 decimal place
    const unitsNeeded = unitWeight ? Math.round((totalKg / unitWeight) * 10) / 10 : 0;
    return { totalKg, unitsNeeded, unit: tomatoData.packaging };
  };

  // Get Wednesday and Thursday dates for this week
  const getWeekdayDate = (weekday) => {
    // weekday: 0=Sunday, 1=Monday, ..., 6=Saturday
    const today = new Date();
    const day = today.getDay();
    const diff = weekday - day;
    const date = new Date(today);
    date.setDate(today.getDate() + diff);
    return date;
  };
  const mondayDate = getCurrentOrNextMonday();
  const tuesdayDate = getRelativeWeekdayDate(mondayDate, 2);   // Tuesday
  const wednesdayDate = getRelativeWeekdayDate(mondayDate, 3); // Wednesday
  const thursdayDate = getRelativeWeekdayDate(mondayDate, 4);  // Thursday

  const wednesdayTomato = getTomatoPrepForDate(wednesdayDate);
  const thursdayTomato = getTomatoPrepForDate(thursdayDate);


  // Handler for checkbox toggle
  const handleCheckboxChange = (name) => {
    setCheckedIngredients(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  // Returns a comma-separated string of unique batch codes for a given ingredient name
  function getBatchCodesForIngredient(ingredientName) {
    // Get this week's batches (Sat-Fri)
    const today = new Date();
    const { year: thisYear, week: thisWeek } = getWeekYear(today);
    const weekBatches = batches.filter(batch => {
      if (!batch.batch_date) return false;
      const batchDate = new Date(batch.batch_date);
      const { year, week } = getWeekYear(batchDate);
      return year === thisYear && week === thisWeek;
    });

    const codes = new Set();
    weekBatches.forEach(batch => {
      (batch.pizzas || []).forEach(pizza => {
        if (
          pizza.ingredientBatchCodes &&
          pizza.ingredientBatchCodes[ingredientName] &&
          pizza.ingredientBatchCodes[ingredientName] !== "-"
        ) {
          codes.add(pizza.ingredientBatchCodes[ingredientName]);
        }
      });
    });
    return Array.from(codes).join(', ');
  }

  useEffect(() => {
    if (!openNote) return;

    function handleClickOutside(e) {
      // Close the popup if any click occurs outside the open note
      setOpenNote(null);
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openNote]);

  return (
    <div className="prep navContent">
      <h2>Prep</h2>
      <p>
        Week Commencing: {getOrdinalDay(mondayDate)} {mondayDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
      </p>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className='prepContainers'>
        <div className='prepBox'>
        <h2 className='dayTitles'>Prep Day </h2>
          <p className='prepDay'>Tuesday {getOrdinalDay(tuesdayDate)}</p>
        <table className='prepTable'>
          <thead>
            <tr>
              <th>Ingredients</th>
              <th>Batch Code</th>
            </tr>
          </thead>
          <tbody>
            {ingredientTotals
              .filter(ing => {
                const ingredientData = ingredients.find(i => i.name === ing.name);
                return ingredientData && ingredientData.prep_ahead === true;
              })
              .map(ing => {
                const ingredientData = ingredients.find(i => i.name === ing.name);
                return (
                  <tr key={ing.name} style={{ position: 'relative' }}>
                    <td>
                      <input
                        type="checkbox"
                        id={`checkbox-${ing.name}`}
                        checked={!!checkedIngredients[ing.name]}
                        onChange={() => handleCheckboxChange(ing.name)}
                      />
                      <label
                        htmlFor={`checkbox-${ing.name}`}
                        className={checkedIngredients[ing.name] ? 'strikethrough' : ''}
                        style={{ marginLeft: 6, marginRight: 4 }}
                      >
                        {ing.name} x {ing.unitsNeeded} {ing.unit}
                      </label>
                      {/* Info icon and click handler OUTSIDE the label */}
                      {ingredientData && ingredientData.prep_notes && (
                        <span
                          style={{ marginLeft: 8, cursor: 'pointer', color: '#007bff' }}
                          onClick={e => {
                            e.stopPropagation();
                            setOpenNote(openNote === ing.name ? null : ing.name);
                          }}
                        >
                          <FontAwesomeIcon icon={faCircleInfo} />
                        </span>
                      )}
                      {/* Prep notes popup */}
                      {openNote === ing.name && ingredientData && ingredientData.prep_notes && (
                        <span
                          style={{
                            position: 'absolute',
                            background: '#222',
                            color: '#fff',
                            padding: '8px 12px',
                            borderRadius: 6,
                            left: 40,
                            zIndex: 10,
                            fontSize: '0.95em',
                            minWidth: 180,
                            maxWidth: 260,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                          }}
                          onClick={e => e.stopPropagation()}
                        >
                          {ingredientData.prep_notes}
                        </span>
                      )}
                    </td>
                    <td>{getBatchCodesForIngredient(ing.name) ? getBatchCodesForIngredient(ing.name) : (<p className='red'>--</p>)}</td>
                  </tr>
                );
              })}
          </tbody>
          <thead>
            <tr>
              <th>Mixes</th>
              <th>Batch Code</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Flour</td>
              <td>{(getBatchCodesForIngredient("Flour (Caputo Red)"))?(getBatchCodesForIngredient("Flour (Caputo Red)")) : (<p className='red'>--</p>)}</td>
            </tr>
            <tr>
              <td>Salt</td>
              <td>{(getBatchCodesForIngredient("Salt"))?(getBatchCodesForIngredient("Salt")) : (<p className='red'>--</p>)}</td>
            </tr>
          </tbody>
        </table>
        </div>
        {/* <div className='prepBox'>
          <h2 className='dayTitles'>Wednesday {getOrdinalDay(wednesdayDate)}</h2>
          {wednesdayTomato && wednesdayTomato.totalKg > 0 && (
            <table className='prepTable'>
              <thead>
                <tr>
                  <th></th>
                  <th>Batch Code</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    Tomato x {wednesdayTomato.unitsNeeded} {wednesdayTomato.unit}
                  </td>
                  <td>{(getBatchCodesForIngredient("Tomato"))?(getBatchCodesForIngredient("Tomato")) : (<p className='red'>--</p>)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        <div className='prepBox'>
          <h2 className='dayTitles'>Thursday {getOrdinalDay(thursdayDate)}</h2>
          {thursdayTomato && thursdayTomato.totalKg > 0 && (
            <table className='prepTable'>
              <thead>
                <tr>
                  <th></th>
                  <th>Batch Code</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    Tomato x {thursdayTomato.unitsNeeded} {thursdayTomato.unit}
                  </td>
                  <td>{getBatchCodesForIngredient("Tomato")}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div> */}
        </div>
      )}
    </div>
  );
}

export default Prep;