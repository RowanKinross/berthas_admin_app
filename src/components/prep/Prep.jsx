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
      data.unitsNeeded = data.unitWeight ? Math.ceil(data.quantity / data.unitWeight) : 0;
    });

    setIngredientTotals(Object.entries(ingredientQuantities).map(([name, data]) => ({
      name,
      ...data
    })));
  }, [batches, ingredients]);

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
            {ingredientTotals.map(ing => (
              <tr key={ing.name}>
                <td>{ing.name} x {ing.unitsNeeded} {ing.unit}</td>
                <td>--</td>
              </tr>
            ))}
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
            {ingredientTotals.map(ing => (
              <tr key={ing.name}>
                <td>{ing.name} x {ing.unitsNeeded} {ing.unit}</td>
                <td>--</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        </div>
      )}
    </div>
  );
}

export default Prep;