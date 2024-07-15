import './batchCodes.css'
import { app, db } from '../firebase/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from '@firebase/firestore';
import { useState, useEffect, useRef } from 'react';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';

function BatchCodes() {
  const [batches, setBatches] = useState([]);
  const [pizzas, setPizzas] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editBatch, setEditBatch] = useState(null);
  const [saveNewMode, setSaveNewMode] = useState(true);
  const [batchDate, setBatchDate] = useState("");
  const [numPizzas, setNumPizzas] = useState(0);
  const [ingredients, setIngredients] = useState("");
  const [batchCode, setBatchCode] = useState("");
  const [completed, setCompleted] = useState(false);
  const [ingredientsOrdered, setIngredientsOrdered] = useState(false);
  const formRef = useRef(null);
  const [showBatch, setShowBatch] = useState(false);
  const [currentBatch, setCurrentBatch] = useState(null);
  const [totalPizzas, setTotalPizzas] = useState(0);


  // display all batches
  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "batches"));
        const batchesData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
          
        // Debug: log batches data
        console.log('Batches Data:', batchesData);
        setBatches(batchesData);
      } catch (error) {
        console.error("Error fetching batches:", error);
      }
    };
    fetchBatches();
  
    const fetchPizzas = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "pizzas"));
        const pizzaData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
  
        // Debug: log fetched pizza data
        console.log('Fetched pizza data:', pizzaData);
  
        // Sort pizzas: first those with sleeve true, then those with sleeve false, both alphabetically
        pizzaData.sort((a, b) => {
          if (a.sleeve === b.sleeve) {
            return a.pizza_title.localeCompare(b.pizza_title);
          }
  
          return a.sleeve ? -1 : 1;
        });
  
        setPizzas(pizzaData);
      } catch (error) {
        console.error("Error fetching pizzas:", error);
      }
    };
    fetchPizzas();
  }, []);
  
  
  
  

  // if user clicks the add button
  const handleAddClick = () => {
    setShowForm(true); // Show the form
    setSaveNewMode(true); // Set mode to save a new batch
    setEditBatch(null); // Clear edit batch data
    setBatchDate(""); // Clear batch date
    setNumPizzas(0); // Clear number of pizzas
    setIngredients(""); // Clear ingredients
    setBatchCode(""); // Clear batch code
    setTotalPizzas(0) // Clear pizza total
    setIngredientsOrdered(false); // Clear ingredients ordered checkbox
  };

  // if user clicks edit
  const handleEditClick = (batch) => {
    setEditBatch(batch);

    setShowForm(true); // Show the form
    setSaveNewMode(false); // Set mode to edit
    setBatchDate(batch.batch_date); // Set batch date for edit
    setNumPizzas(batch.num_pizzas); // Set number of pizzas for edit
    setIngredients(batch.ingredients); // Set ingredients for edit
    setBatchCode(batch.batch_code); // Set batch code for edit
    setCompleted(batch.completed);
    setTotalPizzas(batch.num_pizzas)
    setIngredientsOrdered(batch.ingredients_ordered || false); // Set ingredients ordered checkbox

    // Update pizzas state and calculate totalPizzas
    const updatedPizzas = pizzas.map(pizza => {
      const matchingPizza = batch.pizzas.find(p => p.id === pizza.id);
      return {
        ...pizza,
        quantity: matchingPizza ? matchingPizza.quantity : 0
      };
    });

    setPizzas(updatedPizzas);

    // Calculate totalPizzas
    const newTotal = updatedPizzas.reduce((sum, pizza) => sum + (parseInt(pizza.quantity) || 0), 0);
    setTotalPizzas(newTotal);

  };

  const handleBatchClick = (batch) => {
    setShowBatch(true);
    setCurrentBatch(batch);
    console.log(currentBatch);
  };

  const handleAddFormSubmit = async (e) => {
    e.preventDefault();
    try {
      // Add new batch
      await addDoc(collection(db, "batches"), {
        batch_date: batchDate,
        num_pizzas: numPizzas,
        ingredients: ingredients,
        batch_code: batchCode,
        completed: completed,
        ingredients_ordered: ingredientsOrdered,
      });
      setShowForm(false);
      setEditBatch(null);
      setBatchDate("");
      setNumPizzas(0);
      setIngredients("");
      setBatchCode("");
      setIngredientsOrdered(false);
      setSaveNewMode(false);
      const querySnapshot = await getDocs(collection(db, "batches"));
      const batchesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBatches(batchesData);
    } catch (error) {
      console.error("Error submitting batch:", error);
    }
  };

  const handleEditFormSubmit = async (e) => {
    e.preventDefault();
    try {
      // Update existing batch
      const batchRef = doc(db, "batches", editBatch.id);
      await updateDoc(batchRef, {
        batch_date: batchDate,
        num_pizzas: numPizzas,
        ingredients: ingredients,
        batch_code: batchCode,
        completed: completed,
        ingredients_ordered: ingredientsOrdered,
      });
      setShowForm(false);
      setEditBatch(null);
      setBatchDate("");
      setNumPizzas(0);
      setIngredients("");
      setBatchCode("");
      setIngredientsOrdered(false);
      const querySnapshot = await getDocs(collection(db, "batches"));
      const batchesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBatches(batchesData);
    } catch (error) {
      console.error("Error updating batch:", error);
    }
  };

  const handleDeleteForm = async () => {
    try {
      const batchRef = doc(db, "batches", editBatch.id);
      await deleteDoc(batchRef);
      setShowForm(false);
      setEditBatch(null);
      const querySnapshot = await getDocs(collection(db, "batches"));
      const batchesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBatches(batchesData);
    } catch (error) {
      console.error("Error deleting batch:", error);
    }
  };

  // Handle input changes for both new and edit forms
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    switch (name) {
      case "batch_date":
        setBatchDate(value);
        break;
      case "num_pizzas":
        setNumPizzas(value);
        break;
      case "ingredients":
        setIngredients(value);
        break;
      case "batch_code":
        setBatchCode(value);
        break;
      case "ingredients_ordered":
        setIngredientsOrdered(checked);
        break;
      default:
        break;
    }
  };

  // Handle clicks outside the form
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (formRef.current && !formRef.current.contains(e.target)) {
        setShowForm(false);
      }
    };
    if (showForm) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showForm]);

  return (
    <div className='batchCodes'>
      <h2>BATCH CODES</h2>
      <button className='button' onClick={handleAddClick}>+</button>

      {showForm && (
        <form ref={formRef} onSubmit={saveNewMode ? handleAddFormSubmit : handleEditFormSubmit} className='editForm' as={Row}>
          <Form.Label column sm={3}>
            Batch Date:
          </Form.Label>
          <Col sm={9}>
            <input
              type="date"
              name="batch_date"
              value={batchDate}
              onChange={handleInputChange}
              required
            />
          </Col>
          <Form.Label column sm={3}>
            Number of Pizzas:
          </Form.Label>
          <Col sm={9}>
            {pizzas.map((pizza) => (
              <div key={pizza.id} className='container'>
                {pizza.pizza_title}
                <input 
                  className='inputNumber'
                  type="number"
                  name="quantity"
                  value={pizza.quantity || ""}
                  placeholder='0'
                  onChange={(e) => handleInputChange(e, pizza.id)}
                />
              </div>
            ))}
            <div className='total'>
              <h6>Total: {totalPizzas}</h6>
            </div>
          </Col>

          <Form.Label column sm={3}>
            Ingredients:
          </Form.Label>
          <Col sm={9}>
            <textarea
              name="ingredients"
              value={ingredients}
              onChange={handleInputChange}
              required
            />
          </Col>
          <Form.Label column sm={3}>
            Batch Code:
          </Form.Label>
          <Col sm={9}>
            <input
              type="text"
              name="batch_code"
              value={batchCode}
              onChange={handleInputChange}
              required
            />
          </Col>
          <Form.Label column sm={3}>
            Ingredients Ordered?
            <input
              className='m-2'
              type="checkbox"
              name='ingredients_ordered'
              checked={ingredientsOrdered}
              onChange={handleInputChange}
            />
          </Form.Label>
          {saveNewMode ? (
            <div>
              <button type="button" className='button draft' onClick={handleAddFormSubmit}>Save as draft</button>
            </div>
          ) : (
            <div className='container'>
              <div>
                <button type="button" className='button draft' onClick={handleEditFormSubmit}>Save draft</button>
                <button type="submit" className='button'>Submit</button>
              </div>
              <button type="button" className='button draft' onClick={handleDeleteForm}>delete</button>
            </div>
          )}
        </form>
      )}

      <div>
        <div className='batchText batchHeader container'>
          <p>Batch Date:</p>
          <p>Number of pizzas:</p>
          <p>Ingredients Ordered?</p>
        </div>
      </div>

      {batches
        .sort((a, b) => new Date(a.batch_date) - new Date(b.batch_date))
        .map(batch => (
          <div key={batch.id} className='batchDiv'>
            <button className='batchText button container' onClick={() => handleBatchClick(batch)}>
              <p>{batch.batch_date}</p>
              <p>{batch.num_pizzas}</p>
              {batch.ingredients_ordered ? <p>✓</p> : <p>✘</p>}
            </button>
            <button className='button' onClick={() => handleEditClick(batch)}>edit</button>
          </div>
        ))}
    </div>
  );
}

export default BatchCodes;
