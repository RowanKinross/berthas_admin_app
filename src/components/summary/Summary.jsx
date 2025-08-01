import { useEffect, useState } from 'react';
import { getDocs, collection } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import StockTable from './stockTable';
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
        const sleeveType = pizza.id.endsWith('1') ? '1' : '0';
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

        sleeveTypeTotals[sleeveType] += total;
      }
    });
  });

  const summary = Object.values(totals).map(item => {
    const sleeveTotal = sleeveTypeTotals[item.sleeveType] || 1;
    return {
      ...item,
      ratio: (item.total / sleeveTotal).toFixed(2)
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







  const stockSummary = getStockSummary();

  return (
    <div className='demandSummary'>
      <h2>DEMAND SUMMARY</h2>
      <div className='summaryContainer'>
        <h3>Current Freezer Stock Levels</h3>
        <StockTable data={stockSummary} />
      </div>
    </div>
  );
}

export default Summary;
