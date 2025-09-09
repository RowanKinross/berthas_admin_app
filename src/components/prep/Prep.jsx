// import berthasLogo from '../bertha_logo'
import './prep.css'
import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons';
import { db } from '../firebase/firebase';
import { collection, getDocs, setDoc, getDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import DoughCalculator from './Dough.jsx';

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
  const [checkedSleeves, setCheckedSleeves] = useState({});
  const [openNote, setOpenNote] = useState(null);
  const [editingBatchCode, setEditingBatchCode] = useState(null); // ingredient name
  const [editingBatchCodeValue, setEditingBatchCodeValue] = useState('');
  const [batchCodeSuggestions, setBatchCodeSuggestions] = useState({});
  const [pizzaCatalog, setPizzaCatalog] = useState([]);
  const [extraPrep, setExtraPrep] = useState([]);
  const [newPrepItem, setNewPrepItem] = useState('');

  // Always present static item
  const staticPrepItem = { text: 'organise freezer', done: false };

  // Load extraPrep from Firestore for this week
  useEffect(() => {
    const fetchExtraPrep = async () => {
      const today = new Date();
      const { year, week } = getWeekYear(today);
      const docSnap = await getDoc(doc(db, "prepStatus", `${year}-W${week}`));
      let loaded = [];
      if (docSnap.exists()) {
        const data = docSnap.data();
        loaded = data.extraPrep || [];
      }
      // Ensure 'organise freezer' is always first
      if (!loaded.length || loaded[0].text !== staticPrepItem.text) {
        // If it's missing, add it at the start (preserve checked if present)
        const found = loaded.find(i => i.text === staticPrepItem.text);
        const freezerItem = found || staticPrepItem;
        loaded = [freezerItem, ...loaded.filter(i => i.text !== staticPrepItem.text)];
      }
      setExtraPrep(loaded);
    };
    fetchExtraPrep();
  }, []);

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
    const fetchPizzaCatalog = async () => {
      const pizzaSnap = await getDocs(collection(db, "pizzas"));
      setPizzaCatalog(pizzaSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchPizzaCatalog();
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


  // Save checkedIngredients for this week
  const savePrepStatus = async (checkedIngredients, checkedSleeves) => {
    const today = new Date();
    const { year, week } = getWeekYear(today);
    await setDoc(
      doc(db, "prepStatus", `${year}-W${week}`),
      { checkedIngredients, checkedSleeves, year, week },
      { merge: true }
    );
  };

  // On checkbox change:
  const handleCheckboxChange = (name) => {
    setCheckedIngredients(prev => {
      const updated = { ...prev, [name]: !prev[name] };
      savePrepStatus(updated, checkedSleeves);
      return updated;
    });
  };

  const handleSleeveCheckboxChange = (id) => {
    setCheckedSleeves(prev => {
      const updated = { ...prev, [id]: !prev[id] };
      savePrepStatus(checkedIngredients, updated);
      return updated;
    });
  };

  // On mount, load checkedIngredients for this week:
  useEffect(() => {
    const fetchChecked = async () => {
      const today = new Date();
      const { year, week } = getWeekYear(today);
      const docSnap = await getDoc(doc(db, "prepStatus", `${year}-W${week}`));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCheckedIngredients(data.checkedIngredients || {});
        setCheckedSleeves(data.checkedSleeves || {});
      }
    };
    fetchChecked();
  }, []);

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

  const handleBatchCodeSave = async (ingredientName) => {
    setEditingBatchCode(null);
    const newCode = editingBatchCodeValue.trim();

    // Get this week's batches (Sat-Fri)
    const today = new Date();
    const { year: thisYear, week: thisWeek } = getWeekYear(today);
    const weekBatches = batches.filter(batch => {
      if (!batch.batch_date) return false;
      const batchDate = new Date(batch.batch_date);
      const { year, week } = getWeekYear(batchDate);
      return year === thisYear && week === thisWeek;
    });

    // Update all batches that use this ingredient
    for (const batch of weekBatches) {
      let updated = false;
      const pizzas = (batch.pizzas || []).map(pizza => {
        if ((pizza.ingredients || []).includes(ingredientName)) {
          if (!pizza.ingredientBatchCodes) pizza.ingredientBatchCodes = {};
          if (newCode === "") {
            // Remove the property entirely if cleared
            delete pizza.ingredientBatchCodes[ingredientName];
          } else {
            pizza.ingredientBatchCodes[ingredientName] = newCode;
          }
          updated = true;
        }
        return pizza;
      });
      if (updated) {
        const batchRef = doc(db, "batches", batch.id);
        await updateDoc(batchRef, { pizzas });
      }
    }
  };

  useEffect(() => {
    // Collect batch code suggestions from all batches
    const ingredientCodeMap = {};
    batches.forEach(batch => {
      batch.pizzas?.forEach(pizza => {
        Object.entries(pizza.ingredientBatchCodes || {}).forEach(([ingredient, code]) => {
          if (code?.trim()) {
            if (!ingredientCodeMap[ingredient]) ingredientCodeMap[ingredient] = new Set();
            ingredientCodeMap[ingredient].add(code.trim());
          }
        });
      });
    });
    // Convert sets to arrays for easier use in JSX
    const mapAsArrays = {};
    Object.entries(ingredientCodeMap).forEach(([ingredient, codes]) => {
      mapAsArrays[ingredient] = Array.from(codes);
    });
    setBatchCodeSuggestions(mapAsArrays);
  }, [batches]);

  useEffect(() => {
    const cleanupOldPrepStatus = async () => {
      const today = new Date();
      const { year, week } = getWeekYear(today);
      const currentDocId = `${year}-W${week}`;
      const prepStatusSnap = await getDocs(collection(db, "prepStatus"));
      const deletions = [];
      prepStatusSnap.forEach(docSnap => {
        if (docSnap.id !== currentDocId) {
          deletions.push(deleteDoc(doc(db, "prepStatus", docSnap.id)));
        }
      });
      await Promise.all(deletions);
    };
    cleanupOldPrepStatus();
  }, []);

  useEffect(() => {
    localStorage.setItem('extraPrep', JSON.stringify(extraPrep));
  }, [extraPrep]);

  // When saving, always ensure 'organise freezer' is first
  const saveExtraPrep = async (newList) => {
    let list = newList;
    // Ensure 'organise freezer' is always first and unique
    if (!list.length || list[0].text !== staticPrepItem.text) {
      const found = list.find(i => i.text === staticPrepItem.text) || staticPrepItem;
      list = [found, ...list.filter(i => i.text !== staticPrepItem.text)];
    }
    setExtraPrep(list);
    const today = new Date();
    const { year, week } = getWeekYear(today);
    await setDoc(
      doc(db, "prepStatus", `${year}-W${week}`),
      { extraPrep: list },
      { merge: true }
    );
  };

  const handleAddPrepItem = async () => {
    if (newPrepItem.trim()) {
      const newList = [...extraPrep, { text: newPrepItem.trim(), done: false }];
      await saveExtraPrep(newList);
      setNewPrepItem('');
    }
  };

  const handleTogglePrepItem = async idx => {
    const newList = extraPrep.map((item, i) =>
      i === idx ? { ...item, done: !item.done } : item
    );
    await saveExtraPrep(newList);
  };

  const handleRemovePrepItem = async idx => {
    // Prevent removing the first item ("organise freezer")
    if (idx === 0) return;
    const newList = extraPrep.filter((_, i) => i !== idx);
    await saveExtraPrep(newList);
  };

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
        <h2 className='dayTitles'>To do</h2>
          <p className='prepDay'>Tuesday {getOrdinalDay(tuesdayDate)}</p>
        <table className='prepTable'>
          <thead>
            <tr>
              <th>Prep Ingredients:</th>
            </tr>
          </thead>
            {/* <p>*Subtract any already prepped in the walk-in</p> */}
          <tbody>
            {ingredientTotals
              .filter(ing => {
                const ingredientData = ingredients.find(i => i.name === ing.name);
                return ingredientData && ingredientData.prep_ahead === true;
              })
              .map(ing => {
                const ingredientData = ingredients.find(i => i.name === ing.name);
                const batchCodes = getBatchCodesForIngredient(ing.name);
                return (
                  <React.Fragment key={ing.name}>
                    <tr style={{ position: 'relative' }}>
                      <td>
                        <input
                          type="checkbox"
                          className='prepCheckbox'
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
                            className='infoIcon'
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
                      <td>
                        {/* Empty cell for alignment */}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={2} style={{ paddingLeft: 32, paddingBottom: 8 }}>
                        {editingBatchCode === ing.name ? (
                          <>
                            <input
                              type="text"
                              value={editingBatchCodeValue}
                              list={`batch-code-suggestions-${ing.name}`}
                              autoFocus
                              onChange={e => setEditingBatchCodeValue(e.target.value)}
                              onBlur={() => handleBatchCodeSave(ing.name)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleBatchCodeSave(ing.name);
                                if (e.key === 'Escape') setEditingBatchCode(null);
                              }}
                              style={{ width: 80 }}
                            />
                            <datalist id={`batch-code-suggestions-${ing.name}`}>
                              {(batchCodeSuggestions[ing.name] || [])
                                .filter(code =>
                                  editingBatchCodeValue
                                    ? code.toLowerCase().includes(editingBatchCodeValue.toLowerCase())
                                    : true
                                )
                                .slice(0, 3)
                                .map(code => (
                                  <option key={code} value={code} />
                                ))}
                            </datalist>
                          </>
                        ) : (
                          <span
                            style={{ cursor: 'pointer', color: '#555' }}
                            onClick={() => {
                              setEditingBatchCode(ing.name);
                              setEditingBatchCodeValue(batchCodes);
                            }}
                          >
                            <strong>Batch Code:</strong>{' '}
                            {batchCodes || <span className='red'>--</span>}
                          </span>
                        )}
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
          </tbody>
          <thead>
            <tr>
              <th colSpan={2}>Write Sleeves:</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              // Get this week's batches (Sat-Fri)
              const today = new Date();
              const { year: thisYear, week: thisWeek } = getWeekYear(today);
              const weekBatches = batches
                .filter(batch => {
                  if (!batch.batch_date) return false;
                  const batchDate = new Date(batch.batch_date);
                  const { year, week } = getWeekYear(batchDate);
                  return year === thisYear && week === thisWeek;
                })
                // Sort by batch_date ascending
                .sort((a, b) => new Date(a.batch_date) - new Date(b.batch_date));

              // Helper to format best before date (9 months from batch date)
              const getBestBefore = (batchDateStr) => {
                const batchDate = new Date(batchDateStr);
                const bestBefore = new Date(batchDate);
                bestBefore.setMonth(bestBefore.getMonth() + 9);
                // Adjust for month overflow
                if (bestBefore.getDate() !== batchDate.getDate()) {
                  bestBefore.setDate(0);
                }
                return bestBefore.toLocaleDateString('en-GB');
              };

              return weekBatches.map(batch => {
                // Get all sleeved pizzas in this batch
                const sleevedPizzas = (batch.pizzas || []).filter(pizza => pizza.sleeve && pizza.quantity > 0);
                if (sleevedPizzas.length === 0) return null;
                return (
                  <React.Fragment key={batch.id}>
                    <tr>
                      <td colSpan={2} className='sleeveDateRow'>
                      <div className="sleeveLabel">
                        {new Date(batch.batch_date).toLocaleDateString('en-GB').replace(/\//g, '.')} <br></br> {getBestBefore(batch.batch_date).replace(/\//g, '.')}
                      </div>
                      </td>
                    </tr>
                    {sleevedPizzas.map(pizza => {
                      const displayCount = Math.max(0, (pizza.quantity || 0) - 20);
                      return (
                        <tr key={pizza.id}>
                          <td colSpan={2}>
                            <input
                              type="checkbox"
                              className='prepCheckbox'
                              id={`sleeve-checkbox-${batch.id}-${pizza.id}`}
                              checked={!!checkedSleeves[`${batch.id}-${pizza.id}`]}
                              onChange={() => handleSleeveCheckboxChange(`${batch.id}-${pizza.id}`)}
                              />
                            <label 
                            htmlFor={`sleeve-checkbox-${batch.id}-${pizza.id}`} 
                            className={checkedSleeves[`${batch.id}-${pizza.id}`] ? 'sleeve-strikethrough' : ''}>
                              {pizza.pizza_title} x {displayCount}
                            </label>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              });
            })()}
          </tbody>

          <thead>
            <tr>
              <th>Mixes:</th>
              <th>Batch Code</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Flour</td>
              <td>
                {editingBatchCode === "Flour (Caputo Red)" ? (
                  <input
                    type="text"
                    value={editingBatchCodeValue}
                    autoFocus
                    onChange={e => setEditingBatchCodeValue(e.target.value)}
                    onBlur={() => handleBatchCodeSave("Flour (Caputo Red)")}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleBatchCodeSave("Flour (Caputo Red)");
                      if (e.key === 'Escape') setEditingBatchCode(null);
                    }}
                    style={{ width: 80 }}
                  />
                ) : (
                  <span
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setEditingBatchCode("Flour (Caputo Red)");
                      setEditingBatchCodeValue(getBatchCodesForIngredient("Flour (Caputo Red)"));
                    }}
                  >
                    {getBatchCodesForIngredient("Flour (Caputo Red)") || <span className='red'>--</span>}
                  </span>
                )}
              </td>
            </tr>
            <tr>
              <td>Salt</td>
              <td>
                {editingBatchCode === "Salt" ? (
                  <input
                    type="text"
                    value={editingBatchCodeValue}
                    autoFocus
                    onChange={e => setEditingBatchCodeValue(e.target.value)}
                    onBlur={() => handleBatchCodeSave("Salt")}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleBatchCodeSave("Salt");
                      if (e.key === 'Escape') setEditingBatchCode(null);
                    }}
                    style={{ width: 80 }}
                  />
                ) : (
                  <span
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setEditingBatchCode("Salt");
                      setEditingBatchCodeValue(getBatchCodesForIngredient("Salt"));
                    }}
                  >
                    {getBatchCodesForIngredient("Salt") || <span className='red'>--</span>}
                  </span>
                )}
              </td>
            </tr>
          </tbody>
    
      {/* Extra Prep Checklist */}
      <div className="extraPrepBox">
          <th>Other Prep:</th>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {extraPrep.map((item, idx) => (
              <li key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => handleTogglePrepItem(idx)}
                  style={{ marginRight: 8 }}
                />
                <span
                  style={{
                    textDecoration: item.done ? 'line-through' : 'none',
                    flex: 1
                  }}
                >
                  {item.text}
                </span>
                {/* Only allow remove for non-static items */}
                {idx !== 0 && (
                  <button
                    onClick={() => handleRemovePrepItem(idx)}
                    style={{
                      marginLeft: 8,
                      background: 'none',
                      border: 'none',
                      color: '#c00',
                      cursor: 'pointer',
                      fontSize: '1.1em'
                    }}
                    title="Remove"
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', marginTop: 8 }}>
            <input
              type="text"
              value={newPrepItem}
              onChange={e => setNewPrepItem(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddPrepItem(); }}
              placeholder="Add prep item..."
              style={{ flex: 1, marginRight: 8 }}
            />
            <button onClick={handleAddPrepItem}>Add</button>
          </div>
        </div>


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

         <div className='doughBox'>
          <h2 className='dayTitles'>Dough</h2>
          <DoughCalculator/>
        </div>

        </div>
      )}

    </div>
  );
}

export default Prep;