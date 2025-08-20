import { useEffect, useState, useMemo } from 'react';
import { getDocs, collection } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import StockTable from './stockTable';
import PlannedTable from './plannedTable';
import './summary.css';

function Summary() {
  const [stock, setStock] = useState([]);
  const [pizzas, setPizzas] = useState([]);
  const [orders, setOrders] = useState([]);

  // slider rounder controls
  const [showPercentStock, setShowPercentStock] = useState(false);
  const [showPercentPlanned, setShowPercentPlanned] = useState(false);

  const toDate = (d) => (d?.toDate ? d.toDate() : (d instanceof Date ? d : new Date(d)));

  const PIZZA_GOALS = {
    'MAR_A1': 31,
    'MEA_A1': 27,
    'HAM_A1': 22,
    'NAP_A1': 14,
    'ROS_B1': 5
  };

  const AVERAGE_ORDERING = {
    'MAR_A1': 167,
    'MEA_A1': 126,
    'HAM_A1': 85,
    'NAP_A1': 81,
    'ROS_B1': 38,
    
    'HAM_A0': 5,
    'MAR_A0': 51,
    'MAR_B0': 3,
    'MEA_A0': 50,
    'NAP_A0': 8,
    'ROS_B0': 4,
    'ROS_A0': 19,
  };

// stock data
useEffect(() => {
  const fetchData = async () => {
    try {
      const batchSnapshot = await getDocs(collection(db, 'batches'));
      const pizzaSnapshot = await getDocs(collection(db, 'pizzas'));
      const batchData = batchSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const pizzaData = pizzaSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const ordersSnapshot = await getDocs(collection(db, 'orders'));
      const ordersData = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
      setStock(batchData);
      setPizzas(pizzaData);
      setOrders(ordersData);
      

    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  fetchData();
}, []);



const orderDeliveryDayMap = useMemo(() => {
  const map = {};
  orders.forEach(order => {
    map[order.id] = order.delivery_day;
  });
  return map;
}, [orders]);


const getStockSummary = (stock, pizzas, orders, orderDeliveryDayMap) => {
  const totals = {};
  const sleeveTypeTotals = { '0': 0, '1': 0 };

  const getWeekOffset = (dateLike) => {
    const d = toDate(dateLike);
    if (isNaN(d)) return Infinity;
    const now = new Date();
    // Set now to this week's Monday
    now.setHours(0,0,0,0);
    const dayOfWeek = now.getDay() || 7; // Sunday is 0, so set to 7
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() - dayOfWeek + 1);

    // Get next Monday
    const nextMonday = new Date(thisMonday);
    nextMonday.setDate(thisMonday.getDate() + 7);

    // Get week after next Monday
    const weekAfterNextMonday = new Date(thisMonday);
    weekAfterNextMonday.setDate(thisMonday.getDate() + 14);

    if (d >= thisMonday && d < nextMonday) return 1; // This week
    if (d >= nextMonday && d < weekAfterNextMonday) return 2; // Next week
    if (d >= weekAfterNextMonday && d < new Date(weekAfterNextMonday.getTime() + 7 * 24 * 60 * 60 * 1000)) return 3; // Week after next
    return Infinity;
  };


  stock.forEach(batch => {
    if (!batch.completed) return;

    const allocations = batch.pizza_allocations || [];

    batch.pizzas.forEach(pizza => {
      const completed = allocations
        .filter(a => a.pizzaId === pizza.id && a.status === "completed")
        .reduce((sum, a) => sum + a.quantity, 0);

      const onOrderByWeek = { 1: 0, 2: 0, 3: 0 };
      allocations
      .filter(a => a.pizzaId === pizza.id)
      .forEach(a => {
        let deliveryDay = a.delivery_day || a.date || a.allocation_date;
        if (!deliveryDay && a.orderId) {
          deliveryDay = orderDeliveryDayMap[a.orderId];
        }
        const week = getWeekOffset(deliveryDay);
        if ([1,2,3].includes(week)) {
          onOrderByWeek[week] += a.quantity;
        }
      });

      const total = pizza.quantity - completed;
      const available = total - Object.values(onOrderByWeek).reduce((a, b) => a + b, 0);

      if (total > 0) {
        let sleeveType;
          if (pizza.id === 'TOM_A0') {
            sleeveType = 'base';  // New category
          } else {
            sleeveType = pizza.id.endsWith('1') ? '1' : '0';
          }
        const pizzaDetails = pizzas.find(p => p.id === pizza.id);
        const isSmallScreen = window.matchMedia("(max-width: 600px)").matches;

        const pizzaName = isSmallScreen
          ? pizzaDetails?.title_shortened || "Unnamed Pizza"
          : pizzaDetails?.pizza_title || "Unnamed Pizza";

        if (!totals[pizza.id]) {
          totals[pizza.id] = {
            id: pizza.id,
            name: pizzaName,
            total: 0,
            onOrder: 0,
            onOrder1: 0,
            onOrder2: 0,
            onOrder3: 0,
            available: 0,
            sleeveType,
            color: pizzaDetails?.hex_colour || "#ffffff"
          };
        }

        totals[pizza.id].total += total;
        totals[pizza.id].onOrder1 += onOrderByWeek[1];
        totals[pizza.id].onOrder2 += onOrderByWeek[2];
        totals[pizza.id].onOrder3 += onOrderByWeek[3];
        totals[pizza.id].available += available;

        if (sleeveType !== 'base') {
          sleeveTypeTotals[sleeveType] += total;
        }
      }
    });
  });
  const sleeveOnOrderTotals = { '0': {w1:0,w2:0,w3:0}, '1': {w1:0,w2:0,w3:0} };
  Object.values(totals).forEach(item => {
    if (item.sleeveType === '0' || item.sleeveType === '1') {
      sleeveOnOrderTotals[item.sleeveType].w1 += item.onOrder1;
      sleeveOnOrderTotals[item.sleeveType].w2 += item.onOrder2;
      sleeveOnOrderTotals[item.sleeveType].w3 += item.onOrder3;
    }
  });

  const summary = Object.values(totals).map(item => {
    if (item.sleeveType === 'base') {
      return { ...item }; // no ratio field at all
    }

    const sleeveTotal = sleeveTypeTotals[item.sleeveType] || 1;

    // set status
    const orderedW1 = item.onOrder1 || 0;
    const orderedW2 = item.onOrder2 || 0;
    const orderedW3 = item.onOrder3 || 0;
    const currentStock = item.total || 0;
    const avgOrder = AVERAGE_ORDERING[item.id] || 0;
    let status = "";
    if (orderedW1 > currentStock) {
      status = "Short - Urgent!";
    } else if ((orderedW1 + orderedW2) > currentStock) {
      status = "Low";
    } else if ((orderedW1 + orderedW2) <= currentStock) {
      status = "Available";
    }
    if ((currentStock - (orderedW1 + orderedW2 + orderedW3)) > (3 * avgOrder)) {
      status = "Overstocked";
    }

    return {
      ...item,
      ratio: Math.round((item.total / sleeveTotal) * 100),
      status
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

  const sleeveDenoms = { '0': {current:0,w1:0,w2:0,w3:0}, '1': {current:0,w1:0,w2:0,w3:0} };
  ['0','1'].forEach(s => {
    const cur = sleeveTypeTotals[s] || 0;
    // For current stock, w1/w2/w3 are just the current totals (no planned batches included)
    sleeveDenoms[s] = { current: cur || 1, w1: cur || 1, w2: cur || 1, w3: cur || 1 };
  });
  sleeveDenoms.base = { current: 1, w1: 1, w2: 1, w3: 1 };

  return { stockSummary: result, sleeveDenoms, sleeveOnOrderTotals };
};




const getPlannedSummaryMulti = (stock, pizzas, existingStockSummary = []) => {
  // Sleeve totals from CURRENT stock (for den base)
  const currentSleeveTotals = { '0': 0, '1': 0 };
  existingStockSummary.forEach(item => {
    if (item.sleeveType !== 'base') currentSleeveTotals[item.sleeveType] += item.total;
  });

  // Planned totals by pizza & by horizon (1,2,3 weeks), and sleeve totals per horizon
  const plannedByPizza = {};  // { [pizzaId]: {1: n, 2: n, 3: n} }
  const plannedSleeveTotals = { '0': {1:0,2:0,3:0}, '1': {1:0,2:0,3:0} };

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

  stock.forEach(batch => {
    if (batch.completed) return;
    const allocations = batch.pizza_allocations || [];

    
    // Returns ISO week number and year
    function getISOWeekYear(date) {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      // Set to nearest Thursday: current date + 4 - current day number
      d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
      const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1)/7);
      return { week: weekNo, year: d.getUTCFullYear() };
    }
    
    const getWeekOffset = (dateLike) => {
      const d = toDate(dateLike);
      if (isNaN(d)) return Infinity;
      const now = new Date();
      const { week: thisWeek, year: thisYear } = getISOWeekYear(now);
      const { week: targetWeek, year: targetYear } = getISOWeekYear(d);
    
      const weekDiff = (targetYear - thisYear) * 52 + (targetWeek - thisWeek);
      if (weekDiff === 0) return 1; // This week (Mon–Sun)
      if (weekDiff === 1) return 2; // Next week
      if (weekDiff === 2) return 3; // Week after next
      return Infinity; // ignore 3+ weeks
    };
    const week = getWeekOffset(batch.batch_date);
  if (![1,2,3].includes(week)) return; // ignore 3+ weeks

    batch.pizzas.forEach(pizza => {
      const completed = allocations
        .filter(a => a.pizzaId === pizza.id && a.status === "completed")
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

  const stockNumbers = {
    current: item.total,
    w1: pPlanned[1] || 0,
    w2: pPlanned[2] || 0,
    w3: pPlanned[3] || 0,
  };

  return {
    ...item,
    ratios,
    stockNumbers,
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

  
  return { plannedSummary: result, sleeveDenoms };
  };


  const { stockSummary, sleeveDenoms: stockSleeveDenoms, sleeveOnOrderTotals} = useMemo(
    () => getStockSummary(stock, pizzas, orders, orderDeliveryDayMap),
    [stock, pizzas, orders, orderDeliveryDayMap]
  );

  const { plannedSummary, sleeveDenoms: plannedSleeveDenoms } = useMemo(
    () => getPlannedSummaryMulti(stock, pizzas, stockSummary || []),
    [stock, pizzas, stockSummary]
  );





  return (
    <div className='demandSummary navContent'>
      <h2>DEMAND SUMMARY</h2>
      <div className='demandSummaryFlex'>
        <div className='summaryContainer'>
          <h3>Current Stock</h3>
          <label className="switch percentNumberSlider" title="Switch between percent & quantity">
            <input
              type="checkbox"
              checked={showPercentStock}
              onChange={e => setShowPercentStock(e.target.checked)}
            />
            <span className="slider round"></span>
          </label>
          <StockTable 
          data={stockSummary} 
          showPercent={showPercentStock}
          sleeveDenoms={stockSleeveDenoms}
          sleeveOnOrderTotals={sleeveOnOrderTotals} 
          />
        </div>
        <div className='summaryContainer'>
          <h3>Planned Stock</h3>
          <label className="switch percentNumberSlider" title="Switch between percent & quantity">
            <input
              type="checkbox"
              checked={showPercentPlanned}
              onChange={e => setShowPercentPlanned(e.target.checked)}
            />
            <span className="slider round"></span>
          </label>
          <PlannedTable 
          data={plannedSummary} 
          showPercent={showPercentPlanned}
          sleeveDenoms={plannedSleeveDenoms}
          />
        </div>
      </div>
    </div>
  );
}

export default Summary;
