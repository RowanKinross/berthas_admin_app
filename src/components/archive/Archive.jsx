// import berthasLogo from './bertha_logo'
import './archive.css';
import {useState, useEffect} from 'react';
import { app, db } from '../firebase/firebase';
import { collection, addDoc, getDocs } from '@firebase/firestore'; 

function Archive() {
  // pizzas
  const [pizzaData, setPizzaData] = useState([]); // pizza data from storage
 
  // stock
  const [stock, setStock] = useState([]);
  const [totalStockOverall, setTotalStockOverall] = useState(0);
  const [totalOnOrderOverall, setTotalOnOrderOverall] = useState(0);
  const [totalAvailableOverall, setTotalAvailableOverall] = useState(0);
  const [selectedBatchId, setSelectedBatchId] = useState(null);

  // FETCHES
  // fetch pizza data e.g what pizzas we offer & their hex codes
  const fetchPizzaData = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'pizzas'));
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data()}));
      data.sort((a, b) => {
        if (a.sleeve === b.sleeve) {
          return a.id.localeCompare(b.id);
        }
        return a.sleeve ? -1 : 1;
      });
      setPizzaData(data);
    } catch (error) {
      console.error("Error fetching pizza data:", error); // Debugging statement
    }
  };

  // fetch stock data e.g what pizzas are in stock & their batches
  const fetchStock = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'batches'));
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStock(data);
 
    } catch (error) {
      console.error("Error fetching stock data:", error);
    }
  };



  // calculate totals
  const calculateOverallTotals = (pizzas, batches) => {
  let totalAllocated = 0;

  pizzas.forEach((pizza) => {
    batches.forEach((batch) => {
      if (batch.completed) {
        const completedAllocations = (batch.pizza_allocations || [])
          .filter(a => a.pizzaId === pizza.id && a.status === "completed");

        const allocationSum = completedAllocations.reduce((sum, a) => sum + a.quantity, 0);
        totalAllocated += allocationSum;
      }
    });
  });
  
    setTotalStockOverall(totalAllocated);
  }


  // render pizza data, stock data and ingredients data dynamically
  useEffect(() => {
    fetchPizzaData();
    fetchStock();
  }, []);

  useEffect(() => {
    calculateOverallTotals(pizzaData, stock);
  }, [pizzaData, stock]);


  return (
    <div className='inventory'>
      <h2>ARCHIVE</h2>
        <div className='archiveBox' id='totals'>
        <p>Total: {totalStockOverall}</p>
        </div>
      <div>
      </div>
      {pizzaData.length > 0 ? (
        <div className='inventoryContainer'>
          {pizzaData.map((pizza, pizzaIndex) => {
            let totalStock = 0;


return (
            <div 
              className='pizzas' 
              id={`pizzas${pizza.id}`} 
              key={pizzaIndex} 
              style={{ backgroundColor: pizza.sleeve ? pizza.hex_colour : 'transparent', border: pizza.sleeve ? 'transparent' : `2px dotted ${pizza.hex_colour}` }}
            >
                <div className='pizzaHeader'>
                  <h4 className='pizzaH4' style={{ color: pizza.sleeve ? `#fdfdfd` : `${pizza.hex_colour}` }}>{pizza.pizza_title}</h4>
                </div>
              <div className='pizzaContent' style={{ backgroundColor: pizza.sleeve ? `${pizza.hex_colour}f2` : 'transparent'}}>

                {/* Render inventory details for this pizza */}
                {stock
                  .filter(batch =>
                    batch.completed &&
                    batch.pizzas.some(p => p.id === pizza.id && p.quantity > 0) &&
                    (batch.pizza_allocations || []).some(a => a.pizzaId === pizza.id && a.status === "completed")
                  )
                  .sort((a, b) => b.batch_code.localeCompare(a.batch_code)) // Sort batches by batch_code in descending order
                  .map((batch, index) => (
                    <div className='archiveBox' style={{ backgroundColor: pizza.sleeve ? pizza.hex_colour : 'transparent'}} key={`${pizza.id}-${index}`}>
                      <p>Batch Number: {batch.batch_code}</p>
                      {batch.pizzas.map((p, idx) => (
                        p.id === pizza.id && p.quantity > 0 ? (
                          <div key={idx} className='container right'>
                            {(() => {
                              const onOrder = (batch.pizza_allocations || [])
                                .filter(a => a.pizzaId === p.id && a.status === "completed")
                                .reduce((sum, a) => sum + a.quantity, 0);

                              return (
                                <>
                                  {onOrder > 0 && (
                                    <p>Total: {onOrder}</p>
                                  )}
                                </>
                              );
                            })()}

                          </div>
                        ) : null
                      ))}
                    </div>
                ))}
              </div>
                {/* Render pizza totals */}
                <div className='archiveBox' id='totals'>
                  {(() => {
                    let pizzaStock = 0;
                    stock.forEach((batch) => {
                      if (batch.completed) {
                        const completedAllocations = (batch.pizza_allocations || [])
                          .filter(a => a.pizzaId === pizza.id && a.status === "completed");

                        const allocationSum = completedAllocations.reduce((sum, a) => sum + a.quantity, 0);
                        pizzaStock += allocationSum;
                      }
                    });

                    return (
                    <>
                      <p>Total: {pizzaStock}</p>
                    </>
                    );
                  })()}
                </div>
            </div>
          );
        })}
        </div>
      ) : (
        <p>Loading pizza data...</p>
      )}


    </div>
  );
}

export default Archive;