import { useEffect, useState } from 'react';
import { getDocs, collection } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import StockTable from './stockTable';
import PlannedTable from './plannedTable';
import './summary.css';

function Summary() {
  const [stock, setStock] = useState([]);
  const [pizzas, setPizzas] = useState([]);


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






const getStockSummary = () => {
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




const getPlannedSummary = (existingStockSummary) => {
  const totals = {};
  const sleeveTypeTotals = { '0': 0, '1': 0 };

  // Include stock totals in sleeveTypeTotals
  existingStockSummary.forEach(item => {
    if (item.sleeveType !== 'base') {
      sleeveTypeTotals[item.sleeveType] += item.total;
    }
  });

  stock.forEach(batch => {
    if (batch.completed) return;

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
          sleeveType = 'base';
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

 const summary = existingStockSummary.map(stockItem => {
  const plannedItem = totals[stockItem.id];

  if (stockItem.sleeveType === 'base') {
    return {
      ...stockItem,
      total: plannedItem?.total || 0,
      available: plannedItem?.available || 0,
      onOrder: plannedItem?.onOrder || 0,
      ratio: undefined // no ratio for TOM_A0 or base
    };
  }

  const total = (plannedItem?.total || 0) + stockItem.total;
  const sleeveTotal = sleeveTypeTotals[stockItem.sleeveType] || 1;

  return {
    ...stockItem,
    total: plannedItem?.total || 0,
    available: plannedItem?.available || 0,
    onOrder: plannedItem?.onOrder || 0,
    ratio: Math.round((total / sleeveTotal) * 100)
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





const stockSummary = getStockSummary?.();
const plannedSummary = stockSummary ? getPlannedSummary(stockSummary) : [];

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
