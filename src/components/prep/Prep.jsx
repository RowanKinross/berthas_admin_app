// import berthasLogo from '../bertha_logo'
import './prep.css'
import { useState, useEffect } from 'react';
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

function Prep() {
  const [batches, setBatches] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ingredientTotals, setIngredientTotals] = useState([]);

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
  const wednesdayDate = getWeekdayDate(3); // 3 = Wednesday
  const thursdayDate = getWeekdayDate(4);  // 4 = Thursday

  const wednesdayTomato = getTomatoPrepForDate(wednesdayDate);
  const thursdayTomato = getTomatoPrepForDate(thursdayDate);


  return (
    <div className="prep navContent">
      <h2>Prep for This Week</h2>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className='prepContainers'>
        <div>
            <h2>Tuesday Prep</h2>
        <table>
          <thead>
            <tr>
              <th>Mixes</th>
              <th>Batch Code</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Flour</td>
              <td>--</td>
            </tr>
            <tr>
              <td>Salt</td>
              <td>--</td>
            </tr>
          </tbody>
        </table>
        <table>
          <thead>
            <tr>
              <th>Ingredient</th>
              <th>Batch Code</th>
            </tr>
          </thead>
          <tbody>
            {ingredientTotals
              .filter(ing => {
                const ingredientData = ingredients.find(i => i.name === ing.name);
                return ingredientData && ingredientData.prep_ahead === true;
              })
              .map(ing => (
                <tr key={ing.name}>
                  <td>{ing.name} x {ing.unitsNeeded} {ing.unit}</td>
                  <td>--</td>
                </tr>
              ))}
          </tbody>
        </table>
        </div>
        <div>
            <h2>Wednesday Prep</h2>
        <table>
          <thead>
            <tr>
              <th>Ingredient</th>
              <th>Batch Code</th>
            </tr>
          </thead>
          <tbody>
            {wednesdayTomato && wednesdayTomato.totalKg > 0 && (
              <tr>
                <td>
                  Tomato x {wednesdayTomato.unitsNeeded} {wednesdayTomato.unit} ({wednesdayTomato.totalKg.toFixed(2)} kg)
                </td>
                <td>--</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
        <div>
            <h2>Thursday Prep</h2>
        <table>
          <thead>
            <tr>
              <th>Ingredient</th>
              <th>Batch Code</th>
            </tr>
          </thead>
          <tbody>
            {thursdayTomato && thursdayTomato.totalKg > 0 && (
              <tr>
                <td>
                  Tomato x {thursdayTomato.unitsNeeded} {thursdayTomato.unit} ({thursdayTomato.totalKg.toFixed(2)} kg)
                </td>
                <td>--</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
        </div>
      )}
    </div>
  );
}

export default Prep;