import { useEffect, useState, useMemo } from 'react';
import { getDocs, collection } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import StockTable from './stockTable';
import PlannedTable from './plannedTable';
import OrderingHabitsTable from './orderingHabitsTable';
import OrderingHabitsByCustomer from './orderingHabitsByCustomer';
import './summary.css';

function Summary() {
  const [stock, setStock] = useState([]);
  const [pizzas, setPizzas] = useState([]);
  const [orders, setOrders] = useState([]);

  // slider rounder controls
  const [showPercentStock, setShowPercentStock] = useState(false);
  const [showPercentPlanned, setShowPercentPlanned] = useState(false);
  const [showPercentOrdered, setShowPercentOrdered] = useState(false);

  const toDate = (d) => (d?.toDate ? d.toDate() : (d instanceof Date ? d : new Date(d)));

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


const averageOrdering = useMemo(() => {
  const pizzaTotals = {};
  const pizzaWeeks = {};

  // Calculate 4-week cutoff date
  const now = new Date();
  const fourWeeksAgo = new Date(now);
  fourWeeksAgo.setDate(now.getDate() - 28);
  
  // Debug data for HAM_A1 (Hamageddon)
  const hamOrders = [];

  orders.forEach(order => {
    if (!order.delivery_day || order.delivery_day === "tbc") return;
    const delivery = new Date(order.delivery_day);
    const weekKey = `${order.delivery_week}`;
    
    // Only include orders from the last 4 weeks
    if (delivery >= fourWeeksAgo) {
      Object.entries(order.pizzas || {}).forEach(([pizzaId, pizzaData]) => {
        pizzaTotals[pizzaId] = (pizzaTotals[pizzaId] || 0) + pizzaData.quantity;
        pizzaWeeks[`${pizzaId}_${weekKey}`] = true;
        
        // Collect HAM_A1 orders for debugging
        if (pizzaId === 'HAM_A1') {
          hamOrders.push({
            orderId: order.id,
            deliveryDay: order.delivery_day,
            quantity: pizzaData.quantity,
            weekKey: weekKey,
            customer: order.customer_name
          });
        }
      });
    }
  });

  // Log HAM_A1 orders from last 4 weeks
  console.group('🍖 HAM_A1 (Hamageddon) Orders - Last 4 Weeks');
  console.log(`Found ${hamOrders.length} HAM_A1 orders in the last 4 weeks:`);
  console.log('Four weeks ago cutoff:', fourWeeksAgo.toISOString().split('T')[0]);
  console.log('Today:', now.toISOString().split('T')[0]);
  
  hamOrders.sort((a, b) => new Date(a.deliveryDay) - new Date(b.deliveryDay));
  
  let totalHamQuantity = 0;
  const hamWeeks = new Set();
  
  hamOrders.forEach(order => {
    console.log(`${order.deliveryDay} | Week: ${order.weekKey} | Qty: ${order.quantity} | Customer: ${order.customer} | Order: ${order.orderId}`);
    totalHamQuantity += order.quantity;
    hamWeeks.add(order.weekKey);
  });
  
  console.log(`\nTotal HAM_A1 quantity: ${totalHamQuantity}`);
  console.log(`Number of weeks with HAM_A1 orders: ${hamWeeks.size}`);
  console.log(`Calculated average: ${hamWeeks.size > 0 ? Math.round(totalHamQuantity / hamWeeks.size) : 0}`);
  console.groupEnd();

  const pizzaAverages = {};
  Object.keys(pizzaTotals).forEach(pizzaId => {
    const weeks = Object.keys(pizzaWeeks).filter(key => key.startsWith(pizzaId + '_')).length || 1;
    pizzaAverages[pizzaId] = Math.round(pizzaTotals[pizzaId] / weeks);
  });

  return pizzaAverages;
}, [orders]);




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
    // Set now to this week's saturday
    now.setHours(0,0,0,0);
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
    const thisSaturday = new Date(now);
    thisSaturday.setDate(now.getDate() - ((dayOfWeek + 1) % 7));

    // Get next Saturday
    const nextSaturday = new Date(thisSaturday);
    nextSaturday.setDate(thisSaturday.getDate() + 7);

    // Get week after next saturday
    const weekAfterNextSaturday = new Date(thisSaturday);
    weekAfterNextSaturday.setDate(thisSaturday.getDate() + 14);

    if (d >= thisSaturday && d < nextSaturday) return 1; // This week (Sat–Fri)
    if (d >= nextSaturday && d < weekAfterNextSaturday) return 2; // Next week
    if (d >= weekAfterNextSaturday && d < new Date(weekAfterNextSaturday.getTime() + 7 * 24 * 60 * 60 * 1000)) return 3; // Week after next
    return Infinity;
  };

  const onOrderByPizza = {};
  orders.forEach(order => {
    Object.entries(order.pizzas).forEach(([pizzaId, pizzaData]) => {
      const week = getWeekOffset(order.delivery_day);
      if (!onOrderByPizza[pizzaId]) onOrderByPizza[pizzaId] = { 1: 0, 2: 0, 3: 0 };
      if ([1,2].includes(week)) {
        onOrderByPizza[pizzaId][week] += pizzaData.quantity;
      } else if (week > 2 && week !== Infinity) {
        onOrderByPizza[pizzaId][3] += pizzaData.quantity;
      }
    });
  });

  


  stock.forEach(batch => {
    if (!batch.completed) return;

    const allocations = batch.pizza_allocations || [];

    batch.pizzas.forEach(pizza => {
      const completed = allocations
        .filter(a => a.pizzaId === pizza.id && a.status === "completed")
        .reduce((sum, a) => sum + a.quantity, 0);



      const total = pizza.quantity - completed;
      const pizzaOnOrder = onOrderByPizza[pizza.id] || { 1: 0, 2: 0, 3: 0 };
      const available = total - (pizzaOnOrder[1] + pizzaOnOrder[2] + pizzaOnOrder[3]);

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
        const pizzaOnOrder = onOrderByPizza[pizza.id] || { 1: 0, 2: 0, 3: 0 };
        totals[pizza.id].onOrder1 = pizzaOnOrder[1];
        totals[pizza.id].onOrder2 = pizzaOnOrder[2];
        totals[pizza.id].onOrder3 = pizzaOnOrder[3];
        totals[pizza.id].available += available;

        if (
          sleeveType !== 'base' &&
          pizza.id !== 'DOU_A1' &&
          pizza.id !== 'DOU_A0') {
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
    // removed stock status for now but can re-incorporate
    if (item.sleeveType === 'base'  || item.id === 'DOU_A0' || item.id === 'DOU_A1') {
      return { ...item };
    }

    const sleeveTotal = sleeveTypeTotals[item.sleeveType] || 1;

    // set status
    const orderedW1 = item.onOrder1 || 0;
    const orderedW2 = item.onOrder2 || 0;
    const orderedW3 = item.onOrder3 || 0;
    const currentStock = item.total || 0;
    const avgOrder = averageOrdering[item.id] || 0;
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

  const douA1 = sleeve1.find(item => item.id === 'DOU_A1') || sleeve0.find(item => item.id === 'DOU_A1');
  const douA0 = sleeve0.find(item => item.id === 'DOU_A0') || sleeve1.find(item => item.id === 'DOU_A0');

  // Remove DOU_A1 and DOU_A0 from both arrays, just in case
  const sleeve1Filtered = sleeve1.filter(item => item.id !== 'DOU_A1' && item.id !== 'DOU_A0');
  const sleeve0Filtered = sleeve0.filter(item => item.id !== 'DOU_A0' && item.id !== 'DOU_A1');

  const result = [];
  if (sleeve1Filtered.length) result.push(...sleeve1Filtered);
  result.push({ isGap: true });
  if (sleeve0Filtered.length) result.push(...sleeve0Filtered);
  result.push({ isGap: true });
  if (tomA0) result.push(tomA0);
  if (douA1) result.push(douA1);
  if (douA0) result.push(douA0);

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
    // Set now to this week's Monday
      now.setHours(0,0,0,0);
      const dayOfWeek = now.getDay() || 7; // Sunday is 0, 6 = saturday
      const thisSaturday = new Date(now);
      thisSaturday.setDate(now.getDate() - ((dayOfWeek + 1) % 7));

      // Calculate the difference in days
      const diffDays = Math.floor((d - thisSaturday) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays < 7) return 1;      // This week
      if (diffDays >= 7 && diffDays < 14) return 2;     // Next week
      if (diffDays >= 14 && diffDays < 21) return 3;    // Week after next
      return Infinity; 
    };

    batch.pizzas.forEach(pizza => {
      const completed = allocations
        .filter(a => a.pizzaId === pizza.id && a.status === "completed")
        .reduce((sum, a) => sum + a.quantity, 0);

      const total = pizza.quantity - completed;  // planned qty in this batch for this pizza
      if (total <= 0) return;

      const pizzaDetails = pizzas.find(p => p.id === pizza.id);
      const sleeveType = (pizza.id === 'TOM_A0') ? 'base' : (pizza.id.endsWith('1') ? '1' : '0');

      const week = getWeekOffset(batch.batch_date);

      if (sleeveType === 'base') return; // TOM_A0 and dough balls have no ratio; skip their contribution to sleeves

      if (!plannedByPizza[pizza.id]) plannedByPizza[pizza.id] = {1:0,2:0,3:0};
      plannedByPizza[pizza.id][week] += total;

      // Exclude dough balls from sleeve totals
      if (pizza.id !== 'DOU_A1' && pizza.id !== 'DOU_A0') {
        plannedSleeveTotals[sleeveType][week] += total;
      }
    });
  });


  // Each existing item with per-horizon ratios
  const withRatios = existingStockSummary.map(item => {
  if (item.sleeveType === 'base') {
    return {
      ...item,
      goal: PIZZA_GOALS[item.id],
      ratios: { current: undefined, w1: undefined, w2: undefined, w3: undefined },
      stockNumbers: {
        current: item.total,
        w1: undefined,
        w2: undefined,
        w3: undefined,
      },
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

  const douA1 = sleeve1.find(item => item.id === 'DOU_A1') || sleeve0.find(item => item.id === 'DOU_A1');
  const douA0 = sleeve0.find(item => item.id === 'DOU_A0') || sleeve1.find(item => item.id === 'DOU_A0');

  // Remove DOU_A1 and DOU_A0 from both arrays, just in case
  const sleeve1Filtered = sleeve1.filter(item => item.id !== 'DOU_A1' && item.id !== 'DOU_A0');
  const sleeve0Filtered = sleeve0.filter(item => item.id !== 'DOU_A0' && item.id !== 'DOU_A1');

  const result = [];
  if (sleeve1Filtered.length) result.push(...sleeve1Filtered);
  result.push({ isGap: true });
  if (sleeve0Filtered.length) result.push(...sleeve0Filtered);
  result.push({ isGap: true });
  if (tomA0) result.push(tomA0);
  if (douA1) result.push(douA1);
  if (douA0) result.push(douA0);

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

  //calculate average ordering
  const sleeveAvgTotals = { '0': 0, '1': 0 };
  (stockSummary || []).forEach(item => {
    if (item.sleeveType === '0' || item.sleeveType === '1') {
      sleeveAvgTotals[item.sleeveType] += averageOrdering[item.id] || 0;
    }
  });
const averageOrderingPercent = {};
(stockSummary || []).forEach(item => {
  if (item.sleeveType === '0' || item.sleeveType === '1') {
    const sleeveTotal = sleeveAvgTotals[item.sleeveType];
    const value = sleeveTotal
      ? Math.round((averageOrdering[item.id] / sleeveTotal) * 100)
      : 0;
    averageOrderingPercent[item.id] = isNaN(value) ? '0' : value;
  }
});





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
          averageOrderingPercent={averageOrderingPercent}
          sleeveDenoms={plannedSleeveDenoms}
          />
        </div>

        <div className='summaryContainer'>
          <h3>Ordering Habits</h3>
          <label className="switch percentNumberSlider" title="Switch between percent & quantity">
            <input
              type="checkbox"
              checked={showPercentOrdered}
              onChange={e => setShowPercentOrdered(e.target.checked)}
            />
            <span className="slider round"></span>
          </label>
          <OrderingHabitsTable
            pizzas={pizzas}
            orders={orders}
            summaryOrder={stockSummary}
            averageOrdering={averageOrdering}
            showPercent={showPercentOrdered}
          />
        </div>
        <div className='summaryContainer customerSummaryContainer'>
          <h3>Ordering Habits By Customer</h3>
          <label className="switch percentNumberSlider" title="Switch between percent & quantity">
            <input
              type="checkbox"
              checked={showPercentOrdered}
              onChange={e => setShowPercentOrdered(e.target.checked)}
            />
            <span className="slider round"></span>
          </label>
            <OrderingHabitsByCustomer orders={orders} />
          </div>
      </div>
    </div>
  );
}

export default Summary;
