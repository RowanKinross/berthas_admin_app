import { useEffect, useState } from 'react';
import { getDocs, collection } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import './summary.css';

function Summary() {
  const [stock, setStock] = useState([]);

  useEffect(() => {
    const fetchStock = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'batches'));
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setStock(data);
      } catch (error) {
        console.error("Error fetching stock data:", error);
      }
    };

    fetchStock();
  }, []);


const getStockSummary = () => {
    const totals = {};
    let grandTotal = 0;

    stock.forEach(batch => {
      if (!batch.completed) return;

      batch.pizzas.forEach(pizza => {
        const allocations = batch.pizza_allocations || [];
        const completed = allocations
          .filter(a => a.pizzaId === pizza.id && a.status === "completed")
          .reduce((sum, a) => sum + a.quantity, 0);

        const effective = pizza.quantity - completed;

        if (effective > 0) {
          if (!totals[pizza.id]) totals[pizza.id] = 0;
          totals[pizza.id] += effective;
          grandTotal += effective;
        }
      });
    });

    return Object.entries(totals).map(([id, qty]) => ({
      id,
      quantity: qty,
      percent: ((qty / grandTotal) * 100).toFixed(1)
    }));
  };


const stockSummary = getStockSummary();

  return (
    <div className='demandSummary'>
      <h2>DEMAND SUMMARY</h2>

    <div className='container'>
      <div>
        <h3>Current Freezer Stock Levels:</h3>
        {stockSummary.length === 0 ? (
          <p>Loading or no stock available.</p>
            ) : (
            <ul>
              {stockSummary.map((item, i) => (
                <div key={i}>
                  <strong>{item.id}:</strong> {item.percent}% ({item.quantity} units)
                </div>
              ))}
            </ul>
            )}
        </div>
        <div>
          <h3> Planned Freezer Stock Levels:</h3>
          {stockSummary.length === 0 ? (
          <p>Loading or no stock available.</p>
            ) : (
            <ul>
              {stockSummary.map((item, i) => (
                <div key={i}>
                  <strong>{item.id}:</strong> __ % __ units
                </div>
              ))}
            </ul>
            )}
          </div>
      </div>
    </div>
  );
}

export default Summary;