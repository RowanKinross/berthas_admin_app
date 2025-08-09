import { useEffect, useState, useMemo } from 'react';
import { getDocs, collection } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import StockTable from './stockTable';
import PlannedTable from './plannedTable';
import './summary.css';

function Summary() {
  const [stock, setStock] = useState([]);
  const [pizzas, setPizzas] = useState([]);


  const daysBetween = (a, b) => Math.floor((a - b) / (1000 * 60 * 60 * 24));
  const toDate = (d) => (d?.toDate ? d.toDate() : (d instanceof Date ? d : new Date(d)));
  const getWeekOffset = (dateLike) => {
    const d = toDate(dateLike);
    if (isNaN(d)) return Infinity;
    const diff = daysBetween(d, new Date());
    if (diff <= 7) return 1;
    if (diff <= 14) return 2;
    if (diff <= 21) return 3;
    return Infinity; // ignore 3+ weeks for these columns
  };

    const PIZZA_GOALS = {
    'MAR_A1': 31,
    'MEA_A1': 27,
    'HAM_A1': 22,
    'NAP_A1': 14,
    'ROS_B1': 5
  };

// stock data
useEffect(() => {
  const fetchData = async () => {
    try {
      const batchSnapshot = await getDocs(collection(db, 'batches'));
      const pizzaSnapshot = await getDocs(collection(db, 'pizzas'));

      const batchData = batchSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const pizzaData = pizzaSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      setStock(batchData);
      setPizzas(pizzaData);


    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  fetchData();
}, []);






const getStockSummary = (stock, pizzas) => {
  const totals = {};
  const sleeveTypeTotals = { '0': 0, '1': 0 };

  stock.forEach(batch => {
    if (!batch.completed) return;

    const allocations = batch.pizza_allocations || [];

    batch.pizzas.forEach(pizza => {
      const completed = allocations
        .filter(a => a.pizzaId === pizza.id && a.status === "completed")
        .reduce((sum, a) => sum + a.quantity, 0);

      const onOrder = allocations
        .filter(a => a.pizzaId === pizza.id && a.status !== "completed")
        .reduce((sum, a) => sum + a.quantity, 0);

      const total = pizza.quantity - completed;
      const available = total - onOrder;

      if (total > 0) {
        let sleeveType;
          if (pizza.id === 'TOM_A0') {
            sleeveType = 'base';  // New category
          } else {
            sleeveType = pizza.id.endsWith('1') ? '1' : '0';
          }
        const pizzaDetails = pizzas.find(p => p.id === pizza.id);
        const pizzaName = pizzaDetails?.pizza_title || "Unnamed Pizza";

        if (!totals[pizza.id]) {
          totals[pizza.id] = {
            id: pizza.id,
            name: pizzaName,
            total: 0,
            onOrder: 0,
            available: 0,
            sleeveType,
            color: pizzaDetails?.hex_colour || "#ffffff"
          };
        }

        totals[pizza.id].total += total;
        totals[pizza.id].onOrder += onOrder;
        totals[pizza.id].available += available;

        if (sleeveType !== 'base') {
          sleeveTypeTotals[sleeveType] += total;
        }
      }
    });
  });

  const summary = Object.values(totals).map(item => {
    if (item.sleeveType === 'base') {
      return { ...item }; // no ratio field at all
    }

    const sleeveTotal = sleeveTypeTotals[item.sleeveType] || 1;
    return {
      ...item,
      ratio: Math.round((item.total / sleeveTotal) * 100)
    };
  });

  const tomA0 = summary.find(item => item.id === 'TOM_A0');
  const others = summary.filter(item => item.id !== 'TOM_A0');

  const sleeve1 = others
    .filter(item => item.sleeveType === '1')
    .sort((a, b) => a.id.localeCompare(b.id));

  const sleeve0 = others
    .filter(item => item.sleeveType === '0')
    .sort((a, b) => a.id.localeCompare(b.id));

  const result = [];

  if (sleeve1.length) result.push(...sleeve1, { isGap: true });
  if (sleeve0.length) result.push(...sleeve0);
  if (tomA0) result.push({ isGap: true }, tomA0);

  return result;
};




const getPlannedSummaryMulti = (stock, pizzas, existingStockSummary) => {
  // Sleeve totals from CURRENT stock (for den base)
  const currentSleeveTotals = { '0': 0, '1': 0 };
  existingStockSummary.forEach(item => {
    if (item.sleeveType !== 'base') currentSleeveTotals[item.sleeveType] += item.total;
  });

  // Planned totals by pizza & by horizon (1,2,3 weeks), and sleeve totals per horizon
  const plannedByPizza = {};  // { [pizzaId]: {1: n, 2: n, 3: n} }
  const plannedSleeveTotals = { '0': {1:0,2:0,3:0}, '1': {1:0,2:0,3:0} };

  stock.forEach(batch => {
    if (batch.completed) return;
    const allocations = batch.pizza_allocations || [];
    const week = getWeekOffset(batch.dueDate || batch.plannedDate || batch.date);
    if (![1,2,3].includes(week)) return; // ignore 3+ weeks

    batch.pizzas.forEach(pizza => {
      const completed = allocations
        .filter(a => a.pizzaId === pizza.id && a.status === "completed")
        .reduce((sum, a) => sum + a.quantity, 0);

      const onOrder = allocations
        .filter(a => a.pizzaId === pizza.id && a.status !== "completed")
        .reduce((sum, a) => sum + a.quantity, 0);

      const total = pizza.quantity - completed;  // planned qty in this batch for this pizza
      if (total <= 0) return;

      const pizzaDetails = pizzas.find(p => p.id === pizza.id);
      const sleeveType = (pizza.id === 'TOM_A0') ? 'base' : (pizza.id.endsWith('1') ? '1' : '0');

      if (sleeveType === 'base') return; // TOM_A0 has no ratio; skip its contribution to sleeves

      if (!plannedByPizza[pizza.id]) plannedByPizza[pizza.id] = {1:0,2:0,3:0};
      plannedByPizza[pizza.id][week] += total;

      plannedSleeveTotals[sleeveType][week] += total;
    });
  });

  // current + <= week1, <= week2, <= week3
  const sleeveDenoms = { '0': {current:0,w1:0,w2:0,w3:0}, '1': {current:0,w1:0,w2:0,w3:0} };
  ['0','1'].forEach(s => {
    const cur = currentSleeveTotals[s] || 0;
    const w1 = cur + (plannedSleeveTotals[s]?.[1] || 0);
    const w2 = w1 + (plannedSleeveTotals[s]?.[2] || 0);
    const w3 = w2 + (plannedSleeveTotals[s]?.[3] || 0);
    sleeveDenoms[s] = { current: cur || 1, w1: w1 || 1, w2: w2 || 1, w3: w3 || 1 }; // avoid /0
  });
  sleeveDenoms.base = { current: 1, w1: 1, w2: 1, w3: 1 };

  // Each existing item with per-horizon ratios
  const withRatios = existingStockSummary.map(item => {
  if (item.sleeveType === 'base') {
    return {
      ...item,
      goal: PIZZA_GOALS[item.id],
      ratios: { current: undefined, w1: undefined, w2: undefined, w3: undefined },
      meetsGoal: undefined,
      gapToGoal: undefined,
    };
  }

  const pPlanned = plannedByPizza[item.id] || { 1: 0, 2: 0, 3: 0 };
  const cumulative = {
    w1: item.total + pPlanned[1],
    w2: item.total + pPlanned[1] + pPlanned[2],
    w3: item.total + pPlanned[1] + pPlanned[2] + pPlanned[3],
  };

  const den = sleeveDenoms[item.sleeveType] || { current: 1, w1: 1, w2: 1, w3: 1 };
  const round = n => Math.round(n);

  const ratios = {
    current: round((item.total / den.current) * 100),
    w1:      round((cumulative.w1 / den.w1) * 100),
    w2:      round((cumulative.w2 / den.w2) * 100),
    w3:      round((cumulative.w3 / den.w3) * 100),
  };

  const goal = PIZZA_GOALS[item.id];
  const meetsGoal = goal != null ? ratios.w3 >= goal : undefined;
  const gapToGoal = goal != null ? goal - ratios.w3 : undefined; // positive = shortfall

  return {
    ...item,
    ratios,
    goal,
    meetsGoal,
    gapToGoal,
  };
});


  // Keep ordering/gap logic
  const tomA0 = withRatios.find(item => item.id === 'TOM_A0');
  const others = withRatios.filter(item => item.id !== 'TOM_A0');

  const sleeve1 = others.filter(i => i.sleeveType === '1').sort((a, b) => a.id.localeCompare(b.id));
  const sleeve0 = others.filter(i => i.sleeveType === '0').sort((a, b) => a.id.localeCompare(b.id));

  const result = [];
  if (sleeve1.length) result.push(...sleeve1, { isGap: true });
  if (sleeve0.length) result.push(...sleeve0);
  if (tomA0) result.push({ isGap: true }, tomA0);

  return result;
};

  const stockSummary = useMemo(() => getStockSummary(stock, pizzas), [stock, pizzas]);
  const plannedSummary = useMemo(
    () => getPlannedSummaryMulti(stock, pizzas, stockSummary),
    [stock, pizzas, stockSummary]
  );





  return (
    <div className='demandSummary'>
      <h2>DEMAND SUMMARY</h2>
      <div className='demandSummaryFlex'>
        <div className='summaryContainer'>
          <h3>Current Freezer Stock Levels</h3>
          <StockTable data={stockSummary} />
        </div>
        <div className='summaryContainer'>
          <h3>Planned Stock</h3>
          <PlannedTable data={plannedSummary}/>
        </div>
      </div>
    </div>
  );
}

export default Summary;
