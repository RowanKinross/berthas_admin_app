// import berthasLogo from './bertha_logo'
import './archive.css';
import {useState, useEffect} from 'react';
import { app, db } from '../firebase/firebase';
import { collection, addDoc, getDocs, doc, getDoc, updateDoc} from '@firebase/firestore'; 

function Archive() {
  // pizzas
  const [pizzaData, setPizzaData] = useState([]); // pizza data from storage
 
  // stock
  const [stock, setStock] = useState([]);
  const [totalStockOverall, setTotalStockOverall] = useState(0);
  const [totalOnOrderOverall, setTotalOnOrderOverall] = useState(0);
  const [totalAvailableOverall, setTotalAvailableOverall] = useState(0);
  const [selectedBatchId, setSelectedBatchId] = useState(null);

  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [selectedPizzaId, setSelectedPizzaId] = useState(null);
  const [orders, setOrders] = useState([]);


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

  // fetch orders data
  const fetchOrders = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "orders"));
    const orderList = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    setOrders(orderList);
  } catch (error) {
    console.error("Error fetching orders:", error);
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


const adjustArchive = async (delta) => {
  try {
    const batchRef = doc(db, "batches", selectedBatch.id);
    const batchSnap = await getDoc(batchRef);
    const batchData = batchSnap.data();

    const allocations = [...(batchData.pizza_allocations || [])];
    const pizzas = [...(batchData.pizzas || [])];

    const pizzaIndex = pizzas.findIndex(p => p.id === selectedPizzaId);
    const archivedIndex = allocations.findIndex(a =>
      a.pizzaId === selectedPizzaId &&
      a.orderId === 'archived' &&
      a.status === 'completed'
    );

    if (delta === -1) {
      // ARCHIVE one — increase archived allocation
      if (pizzaIndex === -1) return;

      const completed = allocations
        .filter(a => a.pizzaId === selectedPizzaId && a.status === "completed")
        .reduce((sum, a) => sum + a.quantity, 0);

      const active = allocations
        .filter(a => a.pizzaId === selectedPizzaId && a.status !== "completed")
        .reduce((sum, a) => sum + a.quantity, 0);

      const effective = pizzas[pizzaIndex].quantity - completed;
      const available = effective - active;

      if (available <= 0) return; // nothing left to archive

      if (archivedIndex > -1) {
        allocations[archivedIndex].quantity += 1;
      } else {
        allocations.push({
          pizzaId: selectedPizzaId,
          orderId: 'archived',
          quantity: 1,
          status: 'completed'
        });
      }

    } else if (delta === 1) {
      // UNARCHIVE one
      if (archivedIndex > -1) {
        allocations[archivedIndex].quantity -= 1;

        if (allocations[archivedIndex].quantity <= 0) {
          allocations.splice(archivedIndex, 1);
        }

        // No need to touch pizzas[] here — we're only removing from archive
      } else if (pizzaIndex > -1) {
        // No archived allocation exists — return 1 to total batch quantity
        pizzas[pizzaIndex].quantity += 1;
      }
    }

    // Update Firestore
    await updateDoc(batchRef, {
      pizza_allocations: allocations,
      pizzas: pizzas
    });

    // Update local selectedBatch
    const updatedBatch = {
      ...selectedBatch,
      pizza_allocations: allocations,
      pizzas: pizzas
    };
    setSelectedBatch(updatedBatch);

    // Update overall stock state
    setStock(prevStock =>
      prevStock.map(batch =>
        batch.id === selectedBatch.id
          ? {
              ...batch,
              pizza_allocations: allocations,
              pizzas: pizzas
            }
          : batch
      )
    );

  } catch (error) {
    console.error("❌ Error adjusting archive:", error);
  }
};




  // render pizza data, stock data and ingredients data dynamically
  useEffect(() => {
    fetchPizzaData();
    fetchStock();
    fetchOrders();
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
                    <div className='archiveBox' 
                    style={{ backgroundColor: pizza.sleeve ? pizza.hex_colour : 'transparent', cursor:'pointer'}} 
                    key={`${pizza.id}-${index}`}
                    onClick={() => {
                      setSelectedBatch(batch);
                      setSelectedPizzaId(pizza.id);
                      setShowArchiveModal(true);
                    }
                    }>
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
      {/* Archive batch viewing modal  */}
      {showArchiveModal && selectedBatch && (() => {
        const match = selectedBatch.pizzas.find(p => p.id === selectedPizzaId);
        const total = match?.quantity || 0;

        const completed = (selectedBatch.pizza_allocations || [])
          .filter(a => a.pizzaId === selectedPizzaId && a.status === "completed")
          .reduce((sum, a) => sum + a.quantity, 0);

        const active = (selectedBatch.pizza_allocations || [])
          .filter(a => a.pizzaId === selectedPizzaId && a.status !== "completed")
          .reduce((sum, a) => sum + a.quantity, 0);

        const effective = total - completed;
        const available = effective - active;

        const hasArchivedAllocation = (selectedBatch.pizza_allocations || []).some(
          a => a.pizzaId === selectedPizzaId &&
              a.orderId === 'archived' &&
              a.status === 'completed' &&
              a.quantity > 0
        );

        return (
          <div 
            className="modal"
            onClick={(e) => {
              if (e.target.className === 'modal') {
                setShowArchiveModal(false);
                setSelectedBatch(null);
              }
            }}
          >
            <div className="modalContent"
              style={{
                backgroundColor: pizzaData.find(p => p.id === selectedPizzaId)?.hex_colour || '#fff',
              }}
            >
              <h3>{selectedPizzaId} : batch {selectedBatch.batch_code}</h3>
              <div className='allocationsKey'>
                <h5><strong>Allocations: </strong></h5>
                <div>
                  <p className='packed key'> packed </p>
                  <p className='notPacked key'> not yet packed</p>
                </div>
              </div>
              <div className='archiveModal'>
              {(selectedBatch.pizza_allocations || [])
                .filter(a => a.pizzaId === selectedPizzaId)
                .map((a, i) => {
                  const linkedOrder = orders.find(o => o.id === a.orderId);
                  const accountName = linkedOrder?.customer_name || (a.orderId === 'archived' ? 'archived' : 'unknown');
                  return (
                    <p
                      key={i}
                      className={linkedOrder?.order_status === 'ready to pack' ? 'notPacked' : 'packed' }
                       >
                      {accountName}: {a.quantity}
                    </p>

                  );
                })}
                </div>
              <div style={{ marginTop: '1rem' }}>
                <div className='availableControls'>
                  <p className='available'><strong>Archived:</strong> {completed} of {total}</p>
                  <p onClick={() => adjustArchive(1)} disabled={!hasArchivedAllocation} className='plusArch' title='add found stock'> + </p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}


    </div>
  );
}

export default Archive;