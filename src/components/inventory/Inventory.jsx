// import berthasLogo from './bertha_logo'
import './inventory.css';
import React, {useState, useEffect} from 'react';
import { app, db } from '../firebase/firebase';
import { collection, addDoc, getDocs } from '@firebase/firestore'; 
import { Dropdown, Button, Form } from 'react-bootstrap';

function Inventory() {
  // pizzas
  const [modalVisible, setModalVisible] = useState(false); // modal for adding a new pizza
  const [pizzaTitle, setPizzaTitle] = useState(''); //title of new pizza
  const [hexColour, setHexColour] = useState(''); // colour of new pizza
  const [pizzaData, setPizzaData] = useState([]); // pizza data from storage
  const [sleeve, setSleeve] = useState(false);

  // ingredients
  const [ingredientsArr, setIngredientsArr] = useState([]); // an array of saved ingredients for the dropdown
  const [ingredientName, setIngredientName] = useState('');
  const [currentIngredientQuantity, setCurrentIngredientQuantity] = useState('');
  const [ingredientUnits, setIngredientUnits] = useState('');
  const [addIngredientForm, setAddIngredientForm] = useState(false) // set ingredients form to not show
  const [currentIngredient, setCurrentIngredient] = useState('')
  const [currentPizzaIngredients, setCurrentPizzaIngredients] = useState(["160g x Flour (Caputo Red), 15kg Bag", "4.8g x Salt, 1kg"])
 


  // stock
  const [stock, setStock] = useState([])


  //FETCHES
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
  }
// fetch ingredients array (list of possible ingredients & their weights per unit)
const fetchIngredientsArr = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'ingredients'));
    const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const items = data.map(item => item.name);
    setIngredientsArr(items);
  } catch (error) {
    console.error("Error fetching ingredients data:", error);
  }
}
// render pizza data, stock data and ingredients data dynamically
useEffect(() => {
  fetchPizzaData();
  fetchStock();
  fetchIngredientsArr();
}, []); 





//UPDATE STORE
// add a new ingredient to ingredients array 
const updateIngredientsArr = async (newIngredient) => {
  try {
    await addDoc(collection(db, 'ingredients'), {
      name: newIngredient
    });
  } catch (e) {
    console.error("Error adding document: ", e);
  }
};


//ADD TO STORE
// add pizza function for when user clicks on '+'
  const handleAddPizza = async () => {
    const vegan = currentPizzaIngredients.includes("45g x Vegan Mozzarella, 1kg Pack")? "B" : "A"
    const withSleeve = sleeve ? 1 : 0
    const IDletters = (`${pizzaTitle.charAt(0)}${pizzaTitle.charAt(1)}${pizzaTitle.charAt(2)}`).toUpperCase()

    const ID = `${IDletters}_${vegan}${withSleeve}`
    console.log(ID)
    try {

      await addDoc(collection(db, 'pizzas'), {
        id: ID,
        pizza_title: pizzaTitle,
        ingredients: currentPizzaIngredients,
        hex_colour: hexColour,
        sleeve: sleeve,
      });
      fetchPizzaData();
      closeModal();
      updateIngredientsArr()
      setCurrentPizzaIngredients(["160g x Flour (Caputo Red), 15kg Bag", "4.8g x Salt, 1kg"])
    } catch (e) {
      console.error("Error adding document: ", e);
    }
  };



//ADD PIZZA MODAL
// close the modal
const closeModal = () => {
  setModalVisible(false);
};
const handleCancel = () => {
  closeModal();
  setCurrentPizzaIngredients(["160g x Flour (Caputo Red), 15kg Bag", "4.8g x Salt, 1kg"]);
  setCurrentIngredient('')
};



// function to handle new ingredient inputs
const handleAddIngredient = () => {
  setAddIngredientForm(false); // hide add ingredient form
  const newIngredient = `${currentIngredientQuantity}g x ${ingredientName}, ${ingredientUnits}`;
  setCurrentIngredient(newIngredient);
  setTimeout(async () => {
    await updateIngredientsArr(newIngredient);
    await fetchIngredientsArr(); // Re-fetch ingredients to update dropdown
  }, 0);
  setIngredientName(''); //clear fields
  setIngredientUnits('');
  setCurrentIngredientQuantity('')
}
// add current ingredient to recipe on tick click
const handleAddIngredientToRecipe = () => {
  setCurrentPizzaIngredients([...currentPizzaIngredients, currentIngredient]);
}


const handleRadioChange = (e) => {
  if (e.target.value === 'yes') {
    setSleeve(true);
  } else {
    setSleeve(false);
  }
}
 






return (
  <div className='inventory'>
    <h2>INVENTORY</h2>
            <div>
              <div className='inventoryBox' id='totals'>
                <p>Total Stock:</p>
                <p>Total On Order:</p>
                <p>Total Available:</p>
                </div>
            </div>
    {pizzaData.length > 0 ? (
      <div className='inventoryContainer'>
        {pizzaData.map((pizza, pizzaIndex) => {
          let totalStock = 0;
          let totalOnOrder = 0;
          let totalAvailable = totalStock - totalOnOrder;
          stock.forEach((batch) => {
            if (batch[pizza.id] !== undefined) {
              totalStock += batch[pizza.id];
              totalAvailable += batch[pizza.id];
            }
          });
          
          return (
            // pizzas display 
            <div 
              className='pizzas' 
              id={`pizzas${pizza.id}`} 
              key={pizzaIndex} 
              style={{ backgroundColor: pizza.sleeve ? pizza.hex_colour : 'transparent', border: pizza.sleeve ? 'transparent' :`2px dotted ${pizza.hex_colour}` }}
              >
              <div className='pizzaContent' style={{ backgroundColor: pizza.sleeve? `${pizza.hex_colour}f2`: 'transparent'}}>
                <div className='pizzaHeader'>
                  <h4 className='pizzaH4' style={{color: pizza.sleeve ? `#fdfdfd` : `${pizza.hex_colour}` }}>{pizza.pizza_title}</h4>
                </div>

                {/* Render inventory details for this pizza */}
                {stock.map((batch, index) => (
                  batch[pizza.id] !== undefined ? (
                    <div className='inventoryBox' style={{ backgroundColor: pizza.sleeve ? pizza.hex_colour : 'transparent'}} key={`${pizza.id}-${index}`}>
                      <p>Batch Date: {batch.batch_date}</p>
                      <p>Total: {batch[pizza.id]}</p>
                      <p>On order: 0</p>
                      <p>Available: {batch[pizza.id]}</p>
                    </div>
                  ) : null
                ))}
                {/* Render pizza totals */}
                    <div className='inventoryBox' id='totals'>
                      <p>Total Stock: {totalStock}</p>
                      <p>Total On Order: {totalOnOrder}</p>
                      <p>Total Available: {totalAvailable}</p>
                    </div>
              </div>
            </div>
          );
        })}
        {/* Button to add a new pizza*/}
        <button className='addPizza button pizzas' onClick={() => setModalVisible(true)}>+</button>
      </div>
    ) : (
      <p>Loading pizza data...</p>
  )}



  {/* Modal content for adding a new pizza */}
  {modalVisible && (
    <div className='modal'>
      <div className='modalContent'>
        {/* Form to add a new pizza */}
        <label>
          Name of Pizza:
          <input type='text' onChange={(e) => setPizzaTitle(e.target.value.trim().toUpperCase())} />
        </label>
        <div className='listContainer'>
          <div className='ingredients list'>
            {currentPizzaIngredients.map((ingredient, index) => (
              <li key={index}>
                {`${ingredient}`}
              </li>
            ))}
          </div>
        </div>
        <div className='container ingredientsContainer'>
        {/* Dropdown for selecting an existing ingredient */}
            <Dropdown> 
              <Dropdown.Toggle className='button' variant="outline-warning" id="dropdown-basic">
                {currentIngredient? currentIngredient : 'Select Ingredient'}
              </Dropdown.Toggle>
              <Dropdown.Menu className='ingredientDropdown'>
                {ingredientsArr.map((ingredient, index) => (
                  <Dropdown.Item key={index} onClick={() => {setCurrentIngredient(ingredient)}}>
                    {ingredient}
                  </Dropdown.Item>
                ))}
                  <button className='button' onClick={() => {setAddIngredientForm(true)}}>Add new</button>
              </Dropdown.Menu>
            </Dropdown>
            <button onClick={handleAddIngredientToRecipe}>✔</button>

          </div>
        <label>
          Hex Colour Code:
          <input type='text' placeholder='#eee510' className='inputBox' onChange={(e) => setHexColour(e.target.value)}/>
        </label>
        <label>
          With a sleeve?
          <div className='sleeve'>
          <label>
            Yes
            <input
              type="radio"
              value="yes"
              checked={sleeve === true}
              onChange={handleRadioChange}
              />
          </label>
          <label>
            No
            <input
              type="radio"
              value="no"
              checked={sleeve === false}
              onChange={handleRadioChange}
              />
          </label>
          </div>
        </label>
        {/* Buttons to submit or cancel */}
        <button onClick={handleAddPizza}>Submit</button>
        <button onClick={handleCancel}>Cancel</button>
      </div>
    </div>
  )}
    {addIngredientForm && (
      <div className='modal'>
      <div className='modalContent'>

      <Form.Group>
            <div className='inputBox'>
              Ingredient Name: <input type='text' placeholder='e.g Kalamata Olives' onChange={(e) => setIngredientName(e.target.value)} />
            </div>
            <div className='inputBox'>
              Units: <input type='text' placeholder='e.g 1.8kg Jar' onChange={(e) => setIngredientUnits(e.target.value)} />
            </div>
            <div className='inputBox'>
              Quantity per Pizza (in grams): <input type='number' placeholder='e.g 32' onChange={(e) => setCurrentIngredientQuantity(e.target.value)} />
            </div>
      </Form.Group>
      <Button type="submit" className='button' onClick={() => { handleAddIngredient(); setAddIngredientForm(false)}}>Submit</Button>
      </div>
      </div>
    )}
</div>
);
}

export default Inventory;