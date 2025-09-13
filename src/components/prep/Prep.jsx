// import berthasLogo from '../bertha_logo'
import './prep.css'
import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons';
import { db } from '../firebase/firebase';
import { collection, getDocs, setDoc, getDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import DoughCalculator from './Dough.jsx';

// Helper functions
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
function getCurrentOrNextMonday(date = new Date()) {
  const day = date.getDay();
  const monday = new Date(date);
  if (day === 6) {
    monday.setDate(date.getDate() + 2);
  } else if (day === 0) {
    monday.setDate(date.getDate() + 1);
  } else {
    monday.setDate(date.getDate() - (day - 1));
  }
  monday.setHours(0, 0, 0, 0);
  return monday;
}
function getRelativeWeekdayDate(monday, weekday) {
  const date = new Date(monday);
  date.setDate(monday.getDate() + (weekday - 1));
  return date;
}

function Prep() {
  // --- Week navigation state at the top ---
  const [selectedYearWeek, setSelectedYearWeek] = useState(() => {
    const today = new Date();
    return getWeekYear(today);
  });

  // --- All other state ---
  const [batches, setBatches] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ingredientTotals, setIngredientTotals] = useState([]);
  const [checkedIngredients, setCheckedIngredients] = useState({});
  const [checkedSleeves, setCheckedSleeves] = useState({});
  const [openNote, setOpenNote] = useState(null);
  const [editingBatchCode, setEditingBatchCode] = useState(null);
  const [editingBatchCodeValue, setEditingBatchCodeValue] = useState('');
  const [batchCodeSuggestions, setBatchCodeSuggestions] = useState({});
  const [pizzaCatalog, setPizzaCatalog] = useState([]);
  const [extraPrep, setExtraPrep] = useState([]);
  const [newPrepItem, setNewPrepItem] = useState('');
  const [userRole, setUserRole] = useState(() => localStorage.getItem('userRole') || '');

  // Always present static item
  const staticPrepItem = { text: 'organise freezer', done: false };




  
  // --- Week navigation handlers ---
  const goToPrevWeek = () => {
    let { year, week } = selectedYearWeek;
    week -= 1;
    if (week < 1) {
      year -= 1;
      const lastDayPrevYear = new Date(year, 11, 31);
      week = getWeekYear(lastDayPrevYear).week;
    }
    setSelectedYearWeek({ year, week });
  };
  const goToNextWeek = () => {
    let { year, week } = selectedYearWeek;
    week += 1;
    const maxWeek = getWeekYear(new Date(year, 11, 31)).week;
    if (week > maxWeek) {
      year += 1;
      week = 1;
    }
    setSelectedYearWeek({ year, week });
  };

  // --- Date helpers for selected week ---
const mondayDate = (() => {
  // Find the first Saturday of the year (without mutating jan1)
  const jan1 = new Date(selectedYearWeek.year, 0, 1);
  const jan1Day = jan1.getDay();
  const daysToSaturday = (6 - jan1Day + 7) % 7;
  const firstSaturday = new Date(selectedYearWeek.year, 0, 1 + daysToSaturday);

  // Get the Saturday for this week
  const saturday = new Date(firstSaturday);
  saturday.setDate(firstSaturday.getDate() + (selectedYearWeek.week) * 7);

  // Monday is 2 days after Saturday
  const monday = new Date(saturday);
  monday.setDate(saturday.getDate() + 2);
  return monday;
})();
const tuesdayDate = new Date(mondayDate);
tuesdayDate.setDate(mondayDate.getDate() + 1);
  const wednesdayDate = getRelativeWeekdayDate(mondayDate, 3);
  const thursdayDate = getRelativeWeekdayDate(mondayDate, 4);

  // --- Data fetching ---
  useEffect(() => {
    setLoading(true);
    const fetchData = async () => {
      const batchSnap = await getDocs(collection(db, "batches"));
      const ingredientSnap = await getDocs(collection(db, "ingredients"));
      setBatches(batchSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIngredients(ingredientSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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

  // --- Calculate ingredient totals for selected week ---
  useEffect(() => {
    if (!batches.length || !ingredients.length) return;
    const { year: thisYear, week: thisWeek } = selectedYearWeek;
    const weekBatches = batches.filter(batch => {
      if (!batch.batch_date) return false;
      const batchDate = new Date(batch.batch_date);
      const { year, week } = getWeekYear(batchDate);
      return year === thisYear && week === thisWeek;
    });
    const allPizzas = weekBatches.flatMap(batch => batch.pizzas || []);
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
    Object.keys(ingredientQuantities).forEach(ingredient => {
      const data = ingredientQuantities[ingredient];
      data.quantity = data.quantity / 1000;
      data.unitsNeeded = data.unitWeight ? Math.round((data.quantity / data.unitWeight) * 10) / 10 : 0;
    });
    setIngredientTotals(Object.entries(ingredientQuantities).map(([name, data]) => ({
      name,
      ...data
    })));
  }, [batches, ingredients, selectedYearWeek]);

  // --- Checked ingredients/sleeves for selected week ---
  useEffect(() => {
    const fetchChecked = async () => {
      const { year, week } = selectedYearWeek;
      const docSnap = await getDoc(doc(db, "prepStatus", `${year}-W${week}`));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCheckedIngredients(data.checkedIngredients || {});
        setCheckedSleeves(data.checkedSleeves || {});
      } else {
        setCheckedIngredients({});
        setCheckedSleeves({});
      }
    };
    fetchChecked();
  }, [selectedYearWeek]);

  // --- Extra prep for selected week ---
  useEffect(() => {
    const fetchExtraPrep = async () => {
      const { year, week } = selectedYearWeek;
      const docSnap = await getDoc(doc(db, "prepStatus", `${year}-W${week}`));
      let loaded = [];
      if (docSnap.exists()) {
        const data = docSnap.data();
        loaded = data.extraPrep || [];
      }
      if (!loaded.length || loaded[0].text !== staticPrepItem.text) {
        const found = loaded.find(i => i.text === staticPrepItem.text);
        const freezerItem = found || staticPrepItem;
        loaded = [freezerItem, ...loaded.filter(i => i.text !== staticPrepItem.text)];
      }
      setExtraPrep(loaded);
    };
    fetchExtraPrep();
  }, [selectedYearWeek]);

  // --- Save checked ingredients/sleeves ---
  const savePrepStatus = async (checkedIngredients, checkedSleeves) => {
    const { year, week } = selectedYearWeek;
    await setDoc(
      doc(db, "prepStatus", `${year}-W${week}`),
      { checkedIngredients, checkedSleeves, year, week },
      { merge: true }
    );
  };
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

  // --- Batch code helpers for selected week ---
  function getBatchCodesForIngredient(ingredientName) {
    const { year: thisYear, week: thisWeek } = selectedYearWeek;
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
  const handleBatchCodeSave = async (ingredientName) => {
    setEditingBatchCode(null);
    const newCode = editingBatchCodeValue.trim();
    const { year: thisYear, week: thisWeek } = selectedYearWeek;
    const weekBatches = batches.filter(batch => {
      if (!batch.batch_date) return false;
      const batchDate = new Date(batch.batch_date);
      const { year, week } = getWeekYear(batchDate);
      return year === thisYear && week === thisWeek;
    });
    for (const batch of weekBatches) {
      let updated = false;
      const pizzas = (batch.pizzas || []).map(pizza => {
        if ((pizza.ingredients || []).includes(ingredientName)) {
          if (!pizza.ingredientBatchCodes) pizza.ingredientBatchCodes = {};
          if (newCode === "") {
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

  // --- Batch code suggestions ---
  useEffect(() => {
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
    const mapAsArrays = {};
    Object.entries(ingredientCodeMap).forEach(([ingredient, codes]) => {
      mapAsArrays[ingredient] = Array.from(codes);
    });
    setBatchCodeSuggestions(mapAsArrays);
  }, [batches]);

  // --- Extra prep handlers ---
  const saveExtraPrep = async (newList) => {
    let list = newList;
    if (!list.length || list[0].text !== staticPrepItem.text) {
      const found = list.find(i => i.text === staticPrepItem.text) || staticPrepItem;
      list = [found, ...list.filter(i => i.text !== staticPrepItem.text)];
    }
    setExtraPrep(list);
    const { year, week } = selectedYearWeek;
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
    if (idx === 0) return;
    const newList = extraPrep.filter((_, i) => i !== idx);
    await saveExtraPrep(newList);
  };

  // --- Non-prep-ahead ingredients for this week ---
  const nonPrepAheadIngredients = ingredientTotals
    .filter(ingTotal => {
      const ingredientData = ingredients.find(i => i.name === ingTotal.name);
      return (
        ingredientData &&
        ingredientData.prep_ahead === false &&
        ingTotal.unitsNeeded > 0 &&
        ingTotal.name !== "Flour (Caputo Red)" &&
        ingTotal.name !== "Salt"
      );
    })
    .map(ingTotal => ({
      ...ingTotal,
      ingredientData: ingredients.find(i => i.name === ingTotal.name)
    }));

  // --- Tomato helpers for Wednesday/Thursday ---
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
    const unitsNeeded = unitWeight ? Math.round((totalKg / unitWeight) * 10) / 10 : 0;
    return { totalKg, unitsNeeded, unit: tomatoData.packaging };
  };
  const wednesdayTomato = getTomatoPrepForDate(wednesdayDate);
  const thursdayTomato = getTomatoPrepForDate(thursdayDate);

  // --- UI ---
  return (
    <div className="prep navContent">
      <h2>Prep</h2>
      {userRole === 'admin' && (
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <button onClick={goToPrevWeek} style={{ fontSize: 20, marginRight: 12 }} title="Previous week">
            &#8592;
          </button>
          <span style={{ fontWeight: 'bold', fontSize: 16 }}>
            Week {selectedYearWeek.week}, {selectedYearWeek.year}
          </span>
          <button onClick={goToNextWeek} style={{ fontSize: 20, marginLeft: 12 }} title="Next week">
            &#8594;
          </button>
        </div>
      )}
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
                  <th>Prep Ahead Ingredients:</th>
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
                          <td></td>
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
                                <strong>#</strong>{' '}
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
                  <th>Other Ingredients:</th>
                </tr>
              </thead>
              <tbody>
                {["Flour (Caputo Red)", "Salt"].map((ingredient) => {
                  const total = ingredientTotals.find(i => i.name === ingredient);
                  const batchCodes = getBatchCodesForIngredient(ingredient);
                  return (
                    <React.Fragment key={ingredient}>
                      <tr>
                        <td colSpan={2}>
                          {ingredient}
                          {total && typeof total.unitsNeeded === 'number' && total.unit && (
                            <> x {total.unitsNeeded} {total.unit}</>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={2} style={{ paddingLeft: 32, paddingBottom: 8 }}>
                          {editingBatchCode === ingredient ? (
                            <input
                              type="text"
                              value={editingBatchCodeValue}
                              autoFocus
                              onChange={e => setEditingBatchCodeValue(e.target.value)}
                              onBlur={() => handleBatchCodeSave(ingredient)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleBatchCodeSave(ingredient);
                                if (e.key === 'Escape') setEditingBatchCode(null);
                              }}
                              style={{ width: 80 }}
                            />
                          ) : (
                            <span
                              style={{ cursor: 'pointer', color: '#555' }}
                              onClick={() => {
                                setEditingBatchCode(ingredient);
                                setEditingBatchCodeValue(batchCodes);
                              }}
                              className="batchCode"
                            >
                              <strong>#</strong>{' '}
                              {batchCodes || <span className='red'>--</span>}
                            </span>
                          )}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
                {nonPrepAheadIngredients.map(ing => {
                  const batchCodes = getBatchCodesForIngredient(ing.name);
                  return (
                    <React.Fragment key={ing.name}>
                      <tr>
                        <td colSpan={2}>
                          {ing.name}
                          {typeof ing.unitsNeeded === 'number' && ing.unit && (
                            <> x {ing.unitsNeeded} {ing.unit}</>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={2} style={{ paddingLeft: 32, paddingBottom: 8 }}>
                          {editingBatchCode === ing.name ? (
                            <input
                              type="text"
                              value={editingBatchCodeValue}
                              autoFocus
                              onChange={e => setEditingBatchCodeValue(e.target.value)}
                              onBlur={() => handleBatchCodeSave(ing.name)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleBatchCodeSave(ing.name);
                                if (e.key === 'Escape') setEditingBatchCode(null);
                              }}
                              style={{ width: 80 }}
                            />
                          ) : (
                            <span
                              style={{ cursor: 'pointer', color: '#555' }}
                              onClick={() => {
                                setEditingBatchCode(ing.name);
                                setEditingBatchCodeValue(batchCodes);
                              }}
                              className="batchCode"
                            >
                              <strong>#</strong>{' '}
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
                  const { year: thisYear, week: thisWeek } = selectedYearWeek;
                  const weekBatches = batches
                    .filter(batch => {
                      if (!batch.batch_date) return false;
                      const batchDate = new Date(batch.batch_date);
                      const { year, week } = getWeekYear(batchDate);
                      return year === thisYear && week === thisWeek;
                    })
                    .sort((a, b) => new Date(a.batch_date) - new Date(b.batch_date));
                  const getBestBefore = (batchDateStr) => {
                    const batchDate = new Date(batchDateStr);
                    const bestBefore = new Date(batchDate);
                    bestBefore.setMonth(bestBefore.getMonth() + 9);
                    if (bestBefore.getDate() !== batchDate.getDate()) {
                      bestBefore.setDate(0);
                    }
                    return bestBefore.toLocaleDateString('en-GB');
                  };
                  return weekBatches.map(batch => {
                    const sleevedPizzas = (batch.pizzas || []).filter(pizza => pizza.sleeve && pizza.quantity > 0);
                    if (sleevedPizzas.length === 0) return null;
                    return (
                      <React.Fragment key={batch.id}>
                        <tr>
                          <td colSpan={2} className='sleeveDateRow'>
                            <div className="sleeveLabel">
                              {new Date(batch.batch_date).toLocaleDateString('en-GB').replace(/\//g, '.')} <br /> {getBestBefore(batch.batch_date).replace(/\//g, '.')}

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
            </table>
            {/* Extra Prep Checklist */}
            <div>
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
          </div>
          <div className='doughBox'>
            <h2 className='dayTitles'>Dough</h2>
            <DoughCalculator selectedYearWeek={selectedYearWeek} />
          </div>
        </div>
      )}
    </div>
  );
}

export default Prep;