// import berthasLogo from '../bertha_logo'
import './prep.css'
import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleInfo,faCircleChevronRight, faCircleChevronDown } from '@fortawesome/free-solid-svg-icons';
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
  const [collapseOtherIngredients, setCollapseOtherIngredients] = useState(true);
  const [collapseWriteSleeves, setCollapseWriteSleeves] = useState(true);
  const [selectedPrepDay, setSelectedPrepDay] = useState('Tuesday');
  const prepDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const [extraPrepByDay, setExtraPrepByDay] = useState({});
  const [newPrepItemByDay, setNewPrepItemByDay] = useState({});

  // Always present static item
  const staticPrepItem = { text: 'Organise Freezer', done: false };




  
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
      let checked = {};
      if (docSnap.exists()) {
        const data = docSnap.data();
        checked = data.checkedIngredients || {};
      }
      // Only keep checked ingredients that are needed this week
      const neededIngredients = ingredientTotals
        .filter(i => i.unitsNeeded > 0)
        .map(i => i.name);
      const filteredChecked = Object.fromEntries(
        Object.entries(checked).filter(([name]) => neededIngredients.includes(name))
      );
      setCheckedIngredients(filteredChecked);
    };
    fetchChecked();
  }, [selectedYearWeek, ingredientTotals]);

  // --- Extra prep for selected week ---
  useEffect(() => {
    if (!batches.length || !ingredients.length) return;
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
  }, [selectedYearWeek, batches, ingredients]);

  // --- Save checked ingredients/sleeves ---
  const savePrepStatus = async (checkedIngredients, checkedSleeves) => {
    const { year, week } = selectedYearWeek;
    const neededIngredients = ingredientTotals
      .filter(i => i.unitsNeeded > 0)
      .map(i => i.name);
    const filteredChecked = Object.fromEntries(
      Object.entries(checkedIngredients).filter(([name]) => neededIngredients.includes(name))
    );
    await setDoc(
      doc(db, "prepStatus", `${year}-W${week}`),
      { checkedIngredients: filteredChecked, checkedSleeves, year, week },
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


  // handle clicking outside of prep info
  useEffect(() => {
    if (!openNote) return;

    const handleClick = (e) => {
      // If the click is inside an info popup, do nothing
      if (e.target.closest('.prep-note-popup')) return;
      setOpenNote(null);
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openNote]);


  const otherIngredientsList = ["Flour (Caputo Red)", "Salt"];
  const allOtherBatchCodesFilled = otherIngredientsList.every(
    ing => !!getBatchCodesForIngredient(ing).trim()
  );

// write sleeves checked handler
const { year: thisYear, week: thisWeek } = selectedYearWeek;
const weekBatches = batches.filter(batch => {
  if (!batch.batch_date) return false;
  const batchDate = new Date(batch.batch_date);
  const { year, week } = getWeekYear(batchDate);
  return year === thisYear && week === thisWeek;
});
const allSleeveCheckboxIds = weekBatches
  .flatMap(batch =>
    (batch.pizzas || [])
      .filter(pizza => pizza.sleeve && pizza.quantity > 0)
      .map(pizza => `${batch.id}-${pizza.id}`)
  );
const allSleevesChecked =
  allSleeveCheckboxIds.length > 0 &&
  allSleeveCheckboxIds.every(id => checkedSleeves[id]);

// save selected prep day to firestore
useEffect(() => {
  const saveDay = async () => {
    const { year, week } = selectedYearWeek;
    await setDoc(
      doc(db, "prepStatus", `${year}-W${week}`),
      { selectedPrepDay },
      { merge: true }
    );
  };
  saveDay();
}, [selectedPrepDay, selectedYearWeek]);
useEffect(() => {
  const fetchPrepDay = async () => {
    const { year, week } = selectedYearWeek;
    const docSnap = await getDoc(doc(db, "prepStatus", `${year}-W${week}`));
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.selectedPrepDay) setSelectedPrepDay(data.selectedPrepDay);
      else setSelectedPrepDay('Tuesday'); // default
    } else {
      setSelectedPrepDay('Tuesday'); // default
    }
  };
  fetchPrepDay();
}, [selectedYearWeek]);

// get batch days to organise to do lists
const weekBatchDays = Array.from(
  new Set(
    weekBatches
      .map(batch => {
        const batchDate = new Date(batch.batch_date);
        return batchDate.toLocaleDateString('en-GB', { weekday: 'long' });
      })
  )
);

// Order of weekdays
const weekdayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// Sort batch days by weekday order
const sortedWeekBatchDays = weekBatchDays.slice().sort(
  (a, b) => weekdayOrder.indexOf(a) - weekdayOrder.indexOf(b)
);





  // Local state for checkboxes (optional: you can persist to Firestore if needed)
  const [checkedTomato, setCheckedTomato] = useState({});
  const [checkedHoney, setCheckedHoney] = useState({});

  // Handler functions
  const handleTomatoCheckbox = () => {
    setCheckedTomato(prev => ({ ...prev, [day]: !prev[day] }));
  };
  const handleHoneyCheckbox = () => {
    setCheckedHoney(prev => ({ ...prev, [day]: !prev[day] }));
  };

  // get the extra prep items for the extra days
  useEffect(() => {
    const fetchExtraPrep = async () => {
      const { year, week } = selectedYearWeek;
      const docSnap = await getDoc(doc(db, "prepStatus", `${year}-W${week}`));
      let loaded = {};
      if (docSnap.exists()) {
        const data = docSnap.data();
        loaded = data.extraPrepByDay || {};
      }
      setExtraPrepByDay(loaded);
    };
    fetchExtraPrep();
  }, [selectedYearWeek]);

  const saveExtraPrepByDay = async (newObj) => {
    setExtraPrepByDay(newObj);
    const { year, week } = selectedYearWeek;
    await setDoc(
      doc(db, "prepStatus", `${year}-W${week}`),
      { extraPrepByDay: newObj },
      { merge: true }
    );
  };
  const handleAddPrepItem = async (day) => {
  const text = newPrepItemByDay[day]?.trim();
  if (text) {
    const newList = [...(extraPrepByDay[day] || []), { text, done: false }];
    const newObj = { ...extraPrepByDay, [day]: newList };
    await saveExtraPrepByDay(newObj);
    setNewPrepItemByDay(prev => ({ ...prev, [day]: '' }));
  }
};

const handleTogglePrepItem = async (day, idx) => {
  const newList = (extraPrepByDay[day] || []).map((item, i) =>
    i === idx ? { ...item, done: !item.done } : item
  );
  const newObj = { ...extraPrepByDay, [day]: newList };
  await saveExtraPrepByDay(newObj);
};

const handleRemovePrepItem = async (day, idx) => {
  const newList = (extraPrepByDay[day] || []).filter((_, i) => i !== idx);
  const newObj = { ...extraPrepByDay, [day]: newList };
  await saveExtraPrepByDay(newObj);
};
  





  return (
    <div className="prep navContent">
      <h2>Prep</h2>
      {userRole === 'admin' && (
        <div className='weekViewing' >
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
            <div className='toDoHeader'>
              {userRole === 'admin' ? (
                <>
                <h2 className='dayTitles'>To do</h2>
                <select
                    className='prepDay'
                    value={selectedPrepDay}
                    onChange={e => setSelectedPrepDay(e.target.value)}
                    
                  >
                    {prepDays.map(day => (
                      <option key={day} value={day}>
                        {day} {getOrdinalDay(getRelativeWeekdayDate(mondayDate, prepDays.indexOf(day) + 1))}
                      </option>
                    ))}
                  </select>
                </>
                ) : (
                <>
                <h2 className='dayTitles toDo'>To do</h2>
                  <p className='prepDay'>
                    {selectedPrepDay} {getOrdinalDay(getRelativeWeekdayDate(mondayDate, prepDays.indexOf(selectedPrepDay) + 1))}
                  </p>
                </>
                )}
            </div>
            <table className='prepTable'>
              <thead>
              </thead>
              <tbody>
                {ingredientTotals
                  .filter(ing => {
                    const ingredientData = ingredients.find(i => i.name === ing.name);
                    return ingredientData && ingredientData.prep_ahead === true && ing.unitsNeeded > 0;
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
                              className={checkedIngredients[ing.name] ? 'strikethrough bold' : 'bold'}
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
                                className="prepNotePopup"
                                onClick={e => e.stopPropagation()}
                              >
                                <strong>{ing.name}:</strong> {ingredientData.prep_notes}
                              </span>
                            )}
                          </td>
                          <td></td>
                        </tr>
                        <tr>
                          <td  style={{ paddingLeft: 32}}>
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
                  <th
                    style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center' }}
                    onClick={() => setCollapseOtherIngredients(c => !c)}
                  >
                    <input
                      type="checkbox"
                      checked={allOtherBatchCodesFilled}
                      readOnly
                      style={{ pointerEvents: 'none'}}
                      tabIndex={-1}
                    />
                    <span className='addBatchOtherHeader'>
                      <div>Log batch codes for other ingredients: </div>
                      <span className='collapsibleArrow'>
                        <FontAwesomeIcon icon={collapseOtherIngredients ? faCircleChevronRight : faCircleChevronDown} />
                      </span>
                    </span>
                  </th>
                </tr>
              </thead>
              {!collapseOtherIngredients && (
                <tbody>
                  {["Flour (Caputo Red)", "Salt"].map((ingredient) => {
                    const total = ingredientTotals.find(i => i.name === ingredient);
                    const batchCodes = getBatchCodesForIngredient(ingredient);
                    return (
                      <React.Fragment key={ingredient}>
                        <tr>
                          <td className='otherIngredientsSection bold'>
                            {ingredient}
                            {total && typeof total.unitsNeeded === 'number' && total.unit && (
                              <> x {total.unitsNeeded} {total.unit}</>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td  style={{ paddingLeft: 50}}>
                            {editingBatchCode === ingredient ? (
                              <>
                                <input
                                  type="text"
                                  value={editingBatchCodeValue}
                                  list={`batch-code-suggestions-${ingredient}`}
                                  autoFocus
                                  onChange={e => setEditingBatchCodeValue(e.target.value)}
                                  onBlur={() => handleBatchCodeSave(ingredient)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleBatchCodeSave(ingredient);
                                    if (e.key === 'Escape') setEditingBatchCode(null);
                                  }}
                                  style={{ width: 80 }}
                                />
                                <datalist id={`batch-code-suggestions-${ingredient}`}>
                                  {(batchCodeSuggestions[ingredient] || [])
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
                          <td  className='otherIngredientsSection bold'>
                            {ing.name}
                            {typeof ing.unitsNeeded === 'number' && ing.unit && (
                              <> x {ing.unitsNeeded} {ing.unit}</>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td  style={{ paddingLeft: 50}}>
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
              )}

              {allSleeveCheckboxIds.length > 0 && (
              <>
              <thead>
                <tr>
                  <th
                    className='writeSleevesHeader'
                    onClick={() => setCollapseWriteSleeves(c => !c)}
                  >
                    <input
                      type="checkbox"
                      checked={allSleevesChecked}
                      readOnly
                      style={{ pointerEvents: 'none' }}
                      tabIndex={-1}
                    />
                    <span className='writeSleevesTitle'>Write Sleeves:</span>
                    <span className='collapsibleArrow'>
                      <FontAwesomeIcon icon={collapseWriteSleeves ? faCircleChevronRight : faCircleChevronDown} />
                    </span>
                  </th>
                </tr>
              </thead>
              {!collapseWriteSleeves && (
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
                          <td >
                            <div className='sleeveContainer'>
                              <div>
                                <div className="sleeveLabel">
                                  {new Date(batch.batch_date).toLocaleDateString('en-GB').replace(/\//g, '.')} <br /> {getBestBefore(batch.batch_date).replace(/\//g, '.')}
                                </div>
                              </div>
                              <div className='writeSleevesList bold'>
                                {sleevedPizzas.map(pizza => {
                                  const displayCount = Math.max(0, (pizza.quantity || 0) - 20);
                                  return (
                                    <div key={pizza.id}>
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
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td >
                            <div className='betweenDates'>. . .</div>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  });
                })()}
              </tbody>
              )}
              </>
              )}
            {/* Extra Prep Checklist */}
            </table>
              <ul className='prepTable extraPrepTable'>
                <li>
                  <input
                      type="checkbox"
                      style={{ pointerEvents: 'none' }}
                      tabIndex={-1}
                    />
                    <span className='writeSleevesTitle bold'>Organise Freezer</span>
                </li>
              {(extraPrepByDay[selectedPrepDay] || []).map((item, idx) => (
                <li key={idx} className='extraPrepList bold'>
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => handleTogglePrepItem(selectedPrepDay, idx)}
                  />
                  <span
                    style={{
                      textDecoration: item.done ? 'line-through' : 'none', paddingLeft: 5,
                    }}
                  >
                    {item.text}
                  </span>
                  <button
                    onClick={() => handleRemovePrepItem(selectedPrepDay, idx)}
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
                </li>
              ))}
              <li className='addPrep'>
                <input
                  type="text"
                  value={newPrepItemByDay[selectedPrepDay] || ''}
                  onChange={e => setNewPrepItemByDay(prev => ({ ...prev, [selectedPrepDay]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddPrepItem(selectedPrepDay); }}
                  placeholder="Add prep item..."
                  style={{ flex: 1, marginRight: 8 }}
                />
                <button className='addButton' onClick={() => handleAddPrepItem(selectedPrepDay)}>Add</button>
              </li>
            </ul>
          </div>

          {/* additional prep days */}
          {sortedWeekBatchDays.map(day => {
  // Calculate tomato for this day:
  const date = getRelativeWeekdayDate(mondayDate, prepDays.indexOf(day) + 1);
  const tomatoPrep = getTomatoPrepForDate(date);
  const tomatoKg = tomatoPrep ? tomatoPrep.totalKg : 0;
  const tomatoUnitsNeeded = tomatoPrep ? tomatoPrep.unitsNeeded : 0;
  const tomatoUnit = tomatoPrep ? tomatoPrep.unit : '';

  // Calculate honey for this day:
  const pizzasForDay = getPizzasForDate(date);
  const honeyUsed = pizzasForDay.some(pizza =>
    (pizza.ingredients || []).includes('Honey')
  );

  return (
    <div className='prepBox' key={day}>
      <div className='toDoHeader'>
        <h2 className='dayTitles toDo'>To do: </h2>
        <p className='prepDay'>
          {day} {getOrdinalDay(date)}
        </p>
      </div>
      <table className='prepTable bold'>
        <tbody>
          {tomatoKg > 0 && (
            <tr>
              <td>
                <input
                  type="checkbox"
                  id={`tomato-${day}`}
                  checked={!!checkedTomato[day]}
                  onChange={() => handleTomatoCheckbox(day)}
                  style={{ marginRight: 8 }}
                />
                <label htmlFor={`tomato-${day}`}>
                  Tomato x {tomatoUnitsNeeded} {tomatoUnit}
                </label>
              </td>
            </tr>
          )}
          {honeyUsed && (
            <tr>
              <td>
                <input
                  type="checkbox"
                  id={`honey-${day}`}
                  checked={!!checkedHoney[day]}
                  onChange={() => handleHoneyCheckbox(day)}
                  style={{ marginRight: 8 }}
                />
                <label htmlFor={`honey-${day}`}>Take honey out</label>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <ul className='prepTable extraPrepTable'>
        {(extraPrepByDay[day] || []).map((item, idx) => (
          <li key={idx} className='extraPrepList bold'>
            <input
              type="checkbox"
              checked={item.done}
              onChange={() => handleTogglePrepItem(day, idx)}
            />
            <span style={{
              textDecoration: item.done ? 'line-through' : 'none', paddingLeft: 5,
            }}>
              {item.text}
            </span>
            <button
              onClick={() => handleRemovePrepItem(day, idx)}
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
          </li>
        ))}
        <li className='addPrep'>
          <input
            type="text"
            value={newPrepItemByDay[day] || ''}
            onChange={e => setNewPrepItemByDay(prev => ({ ...prev, [day]: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') handleAddPrepItem(day); }}
            placeholder="Add prep item..."
            style={{ flex: 1, marginRight: 8 }}
          />
          <button className='addButton' onClick={() => handleAddPrepItem(day)}>Add</button>
        </li>
      </ul>
    </div>
  );
})}

          <div className='doughBox'>
            <h2 className='dayTitles'>Dough</h2>
            <DoughCalculator selectedYearWeek={selectedYearWeek} getWeekYear={getWeekYear} />
          </div>
        </div>
      )}
    </div>
  );
}

export default Prep;