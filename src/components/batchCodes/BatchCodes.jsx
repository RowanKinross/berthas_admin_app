import './batchCodes.css'
import { db } from '../firebase/firebase';
import { collection, getDoc, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { useState, useEffect, useRef } from 'react';
import { Col, Row, Form } from 'react-bootstrap';

function BatchCodes() {
  const [batches, setBatches] = useState([]);
  const [pizzas, setPizzas] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  const [batchDate, setBatchDate] = useState("");
  const [ingredients, setIngredients] = useState([]);
  const [batchCode, setBatchCode] = useState("");
  const [completed, setCompleted] = useState(false);
  const [ingredientsOrdered, setIngredientsOrdered] = useState(false);
  const [pizzaNumbersComplete, setPizzaNumbersComplete] = useState(false);
  const [notes, setNotes] = useState("");
  const formRef = useRef(null)
  const [totalPizzas, setTotalPizzas] = useState(0);
  const [selectedPizzas, setSelectedPizzas] = useState([]);
  const [consolidatedIngredients, setConsolidatedIngredients] = useState([]);
  const [ingredientBatchCodes, setIngredientBatchCodes] = useState({});
  const [loading, setLoading] = useState(true);
  const [viewingBatch, setViewingBatch] = useState(null); // Track viewing mode
  const batchDetailsRef = useRef(null);
  const [showPizzaPicker, setShowPizzaPicker] = useState(false);
  const [batchCodeSuggestions, setBatchCodeSuggestions] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  //pagination
  const [currentPage, setCurrentPage] = useState(1);
  const batchesPerPage = 20;
  function getPagination(currentPage, totalPages) {
  const pages = [];
  if (totalPages <= 7) {
    // Show all pages if not too many
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    // Always show first, last, current, and neighbors
    pages.push(1);
    if (currentPage > 4) pages.push('...');
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      if (i !== 1 && i !== totalPages) pages.push(i);
    }
    if (currentPage < totalPages - 3) pages.push('...');
    pages.push(totalPages);
  }
  return pages;
}

  // Sort ingredients specifically:-
  const INGREDIENT_ORDER = [
    "Flour (Caputo Red)",
    "Salt",
    // The rest will be handled alphabetically except for these at the end:
    "Tomato",
    "Ham",
    "Rapeseed Oil",
    "Vegan Mozzarella",
    "Mozzarella"
  ];
  const sortIngredients = (ingredients) => {
    // Ingredients to always put at the end (except Flour, Salt, Rye Flour which are at the start)
    const endSet = new Set(["Tomato", "Rapeseed Oil", "Ham", "Vegan Mozzarella", "Mozzarella"]);
    const startSet = new Set(["Flour (Caputo Red)", "Salt", "Rye Flour"]);
    // Split into start, middle (alphabetical), and end
    const start = [];
    const end = [];
    const middle = [];
    ingredients.forEach(ing => {
      if (startSet.has(ing.name)) start.push(ing);
      else if (endSet.has(ing.name)) end.push(ing);
      else middle.push(ing);
    });
    // Alphabetically sort the middle
    middle.sort((a, b) => a.name.localeCompare(b.name));
    // Order the end according to INGREDIENT_ORDER
    end.sort((a, b) => INGREDIENT_ORDER.indexOf(a.name) - INGREDIENT_ORDER.indexOf(b.name));
    // Start + middle + end
    return [
      ...start,
      ...middle,
      ...end
    ];
  }



  const PIZZA_ORDER = [
    "ROS_B1",
    "ROS_B0",
    "MAR_B0",
    "ROS_A0",
    "MAR_A1",
    "MAR_A0",
    "NAP_A1",
    "NAP_A0",
    "HAM_A1",
    "HAM_A0",
    "MEA_A1",
    "MEA_A0"
  ]
  const sortPizzas = (pizzas) => {
  const startSet = new Set(PIZZA_ORDER);
  const start = [];
  const end = [];
  pizzas.forEach(pizza => {
    if (startSet.has(pizza.id)) start.push(pizza);
    else end.push(pizza);
  });
  // Alphabetically sort the end set by pizza_title
  end.sort((a, b) => a.pizza_title.localeCompare(b.pizza_title));
  // Order the start according to PIZZA_ORDER
  start.sort((a, b) => PIZZA_ORDER.indexOf(a.id) - PIZZA_ORDER.indexOf(b.id));
  // Start + end
  return [
    ...start,
    ...end
  ];
};


// format batch date
const formatDateDisplay = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  };

  // format batch date for batch list with day of week and conditional batch code
  const formatBatchListDate = (dateStr, batchCode, userRole, isSearching) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const formattedDate = date.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "2-digit", 
      month: "short",
      year: "numeric"
    });
    
    if (userRole === 'admin' && batchCode && isSearching) {
      return (
        <span>
          {formattedDate} <span style={{ color: '#888' }}>#{batchCode}</span>
        </span>
      );
    }
    
    return formattedDate;
  };


  // format batchDate for labelling 
  const getBatchDate = (batchDateStr) => {
    if (!batchDateStr) return "";
    const [year, month, day] = batchDateStr.split("-").map(Number);
    const batchDate = new Date(year, month - 1, day); // JS months are 0-based
    // Format as DD.MM.YY
    return batchDate.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit"
    }).replace(/\//g, ".");
  }
  // format best before date for labelling
  const getBestBeforeDate = (batchDateStr) => {
  if (!batchDateStr) return "";
  const [year, month, day] = batchDateStr.split("-").map(Number);
  // JS months are 0-based
  let bestBefore = new Date(year, month - 1 + 9, day);

  // If the day rolled over to the next month, set to 1st of following month
  if (bestBefore.getDate() !== day) {
    // Move to 1st of the next month
    bestBefore = new Date(bestBefore.getFullYear(), bestBefore.getMonth() + 1, 1);
  }
  // Format as DD.MM.YY
  return bestBefore.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit"
    }).replace(/\//g, ".");
  }


  // display all batches
  useEffect(() => {
  const unsubscribe = onSnapshot(collection(db, "batches"), (querySnapshot) => {
    const batchesData = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setBatches(batchesData);

    // Build ingredient-specific batch code suggestions from live data
    const ingredientCodeMap = {};
    batchesData.forEach(batch => {
      batch.pizzas?.forEach(pizza => {
        Object.entries(pizza.ingredientBatchCodes || {}).forEach(([ingredient, code]) => {
          if (code?.trim()) {
            if (!ingredientCodeMap[ingredient]) ingredientCodeMap[ingredient] = new Set();
            ingredientCodeMap[ingredient].add(code.trim());
          }
        });
      });
    });
    // Convert sets to arrays for easier use in JSX
    const mapAsArrays = {};
    Object.entries(ingredientCodeMap).forEach(([ingredient, codes]) => {
      mapAsArrays[ingredient] = Array.from(codes);
    });
    setBatchCodeSuggestions(mapAsArrays);

    // setBatchCodeSuggestions(Array.from(seenCodes));
  }, (error) => {
    console.error("Error listening to batches:", error);
  });

  return () => unsubscribe(); // Clean up listener on unmount
  }, []);

    
  useEffect(() => {
  // FETCH ingredients
    const fetchIngredients = async () => {
      setLoading(true); // Set loading to true at the start
      try {
        const querySnapshot = await getDocs(collection(db, "ingredients"));
        const ingredientsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setIngredients(ingredientsData);
      } catch (error) {
        console.error("Error fetching ingredients:", error);
      } finally {
        setLoading(false); // Set loading to false when done
      }
    };
    fetchIngredients();


    const fetchPizzas = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "pizzas"));
        const pizzaData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
  
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

  
    useEffect(() => {
      const refreshBatchData = async () => {
        if (!viewingBatch) return;
        
        try {
          const batchRef = doc(db, "batches", viewingBatch.id);
          const freshSnap = await getDoc(batchRef);
          if (freshSnap.exists()) {
            const freshData = { id: freshSnap.id, ...freshSnap.data() };
            setViewingBatch(freshData);
          }
        } catch (error) {
          console.error("Error refreshing batch data:", error);
        }
      };

      const handleWindowFocus = () => {
        if (viewingBatch) {
          refreshBatchData();
        }
      };

      window.addEventListener('focus', handleWindowFocus);
      return () => window.removeEventListener('focus', handleWindowFocus);
    }, [viewingBatch]);
  
  

  const formatDateToBatchCode = (dateString) => {
    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
      return ''; // Return an empty string if the date is invalid
    }
    
    // Format as YYYYMMDD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}${month}${day}`;
  }

  useEffect(() => {
    // When batchDate changes, update the batchCode
    if (batchDate) {
      const formattedBatchCode = formatDateToBatchCode(batchDate);
      setBatchCode(formattedBatchCode);
    }
  }, [batchDate]);


  // if user clicks the add button
  const handleAddClick = () => {
  // Close any open editing fields before opening form
  setEditingField(null);
  setEditingValue("");
  
  setShowForm(true); // Show the form
  setBatchDate(""); // Clear batch date
  setTotalPizzas(0) // Clear pizza total
  setIngredientsOrdered(false); // Clear ingredients ordered checkbox
  setSelectedPizzas([]);
  setPizzas(pizzas.map(pizza => ({ ...pizza, quantity: 0 })));
  setIngredientBatchCodes({});
  setNotes("")
}; 


  const handleQuantityChange = (e, pizzaId) => {
    const { value } = e.target;
    const updatedPizzas = pizzas.map(pizza => {
      if (pizza.id === pizzaId) {
        return { ...pizza, quantity: parseInt(value) || 0 };
      }
      return pizza;
    });
  
    setPizzas(updatedPizzas);
  
    const newSelectedPizzas = updatedPizzas
    .filter(pizza => pizza.quantity > 0)
    .map(pizza => ({
      ...pizza,
      ingredientBatchCodes: pizza.ingredientBatchCodes
    }));
    setSelectedPizzas(newSelectedPizzas);

    consolidateIngredients(newSelectedPizzas); // Consolidate ingredients
  
    // Update the total pizzas count (excluding dough balls)
    const newTotal = updatedPizzas.reduce((sum, pizza) => {
      if (pizza.id === "DOU_A1" || pizza.id === "DOU_A0") return sum;
      return sum + (pizza.quantity || 0);
    }, 0);
    setTotalPizzas(newTotal);
  };


  const parseIngredientRatio = (ratioString) => {
    // Split the ratioString by ':' and trim whitespace
    const [gramsPerPizza, unitWeight] = ratioString.split(':').map(part => part.trim());
    // Convert gramsPerPizza to a number
    const gramsPerPizzaNumber = parseFloat(gramsPerPizza);
    // Convert unitWeight to a number (it's in kilograms)
    const unitWeightNumber = parseFloat(unitWeight);
    return {
      gramsPerPizza: gramsPerPizzaNumber,
      unitWeight: unitWeightNumber
    };
  };
  

  const calculateIngredientQuantities = (selectedPizzas) => {
    const ingredientQuantities = {};
  
    selectedPizzas.forEach(pizza => {
    pizza.ingredients.forEach(ingredientName => {
    const ingredientData = ingredients.find(ing => ing.name === ingredientName);
  
        if (ingredientData) {
          const { gramsPerPizza, unitWeight } = parseIngredientRatio(ingredientData.ratio);
  
          if (!ingredientQuantities[ingredientData.name]) {
            ingredientQuantities[ingredientData.name] = {
              quantity: 0,
              unit: ingredientData.packaging,
              unitWeight: unitWeight
            };
          }
          // Calculate total quantity required in grams
          ingredientQuantities[ingredientData.name].quantity += (gramsPerPizza * pizza.quantity);
        }
      });
    });
  
    // Convert quantities to kilograms
    Object.keys(ingredientQuantities).forEach(ingredient => {
      ingredientQuantities[ingredient].quantity /= 1000; // Convert grams to kilograms
    });
  
    return ingredientQuantities;
  };

  
  const formatQuantity = (quantity) => {
    return parseFloat(quantity).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };
  

   const consolidateIngredients = (selectedPizzas) => {
    const ingredientQuantities = calculateIngredientQuantities(selectedPizzas);

    const consolidated = Object.entries(ingredientQuantities).map(([ingredient, data]) => {
      return {
        name: ingredient,
        quantity: data.quantity,
        unit: data.unit,
        unitWeight: data.unitWeight
      };
    });

    setConsolidatedIngredients(consolidated);
  };
  

  const handleBatchClick = (batch) => {
  // Close any open editing fields before switching batches
  setEditingField(null);
  setEditingValue("");
  
  setViewingBatch({
    ...batch,
    ingredientBatchCodes: batch.pizzas.reduce((acc, pizza) => {
      pizza.ingredients.forEach(ingredient => {
        if (pizza.ingredientBatchCodes && pizza.ingredientBatchCodes[ingredient]) {
          acc[ingredient] = pizza.ingredientBatchCodes[ingredient];
        }
      });
      return acc;
    }, {})
  });

  setIngredientsOrdered(batch.ingredients_ordered || false);

  setTimeout(() => {
    batchDetailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 0);
};

  const handleAddFormSubmit = async (e) => {
    e.preventDefault();
    if (!batchDate) {
      alert("Please select a batch date before saving.");
      return;
    }
    try {
      // Calculate total pizzas excluding dough balls
      const totalPizzasExcludingDough = pizzas
        .filter(pizza => pizza.quantity > 0 && pizza.id !== "DOU_A1" && pizza.id !== "DOU_A0")
        .reduce((sum, pizza) => sum + pizza.quantity, 0);

      // Add new batch
      await addDoc(collection(db, "batches"), {
        batch_date: batchDate,
        num_pizzas: totalPizzasExcludingDough,
        batch_code: batchCode,
        completed: completed,
        ingredients_ordered: ingredientsOrdered,
        pizza_numbers_complete: pizzaNumbersComplete,
        pizzas: pizzas.filter(pizza => pizza.quantity > 0).map(pizza => ({
          id: pizza.id,
          quantity: pizza.quantity,
          quantity_on_order: 0,
          pizza_title: pizza.pizza_title,
          sleeve: pizza.sleeve,
          ingredients: pizza.ingredients,
          ingredientBatchCodes: pizza.ingredients.reduce((acc, ingredient) => {
            acc[ingredient] = ingredientBatchCodes[ingredient] || "";
            return acc;
          }, {}),
          firstPizzaWeight: pizza.firstPizzaWeight || null,
          middlePizzaWeight: pizza.middlePizzaWeight || null,
          lastPizzaWeight: pizza.lastPizzaWeight || null,
        })),
        notes: notes,
      });
      setShowForm(false);
      setBatchDate("");
      setBatchCode("");
      setCompleted(false);
      setIngredientsOrdered(false);
      setNotes("")
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

  


  const handleDeleteForm = async () => {
    try {
      const batchRef = doc(db, "batches", viewingBatch.id);
      await deleteDoc(batchRef);
      
      setViewingBatch(null)

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
      case "ingredients":
        setIngredients(value);
        break;
      case "batch_code":
        setBatchCode(value);
        break;
      case "ingredients_ordered":
        setIngredientsOrdered(checked);
        break;
      case "pizza_numbers_complete":
        setPizzaNumbersComplete(checked);
      break;
      case "notes":
        setNotes(value);  // Update state for notes
        break;
      default:
        break;
    }
  };

  const handleInlineSave = async (type, id, field, value) => {
    setEditingField(null);
  
    try {
      const batchRef = doc(db, "batches", viewingBatch.id);
      const currentSnap = await getDoc(batchRef);
      const currentData = currentSnap.data();
  
      // Add validation for pizza fields
      if (type === "pizza") {
        const existingPizza = currentData.pizzas.find(p => p.id === id);
        const currentViewingPizza = viewingBatch.pizzas.find(p => p.id === id);
        
        // Check if someone else modified this field since we loaded the data
        if (existingPizza && currentViewingPizza) {
          const dbValue = existingPizza[field];
          const ourValue = currentViewingPizza[field];
          
          if (dbValue !== ourValue && dbValue != null) {
            const confirmOverride = window.confirm(
              `Warning: This field was recently updated to "${dbValue}" by another user. ` +
              `Do you want to override it with "${value}"?`
            );
            if (!confirmOverride) {
              // Refresh the viewing batch with latest data
              const freshData = { id: currentSnap.id, ...currentData };
              setViewingBatch(freshData);
              return;
            }
          }
        }
      }
  
      // Add similar validation for ingredient batch codes
      if (type === "ingredient") {
        const existingCodes = {};
        currentData.pizzas.forEach(pizza => {
          Object.entries(pizza.ingredientBatchCodes || {}).forEach(([ingredient, code]) => {
            if (code?.trim()) existingCodes[ingredient] = code.trim();
          });
        });
        
        const ourCodes = {};
        viewingBatch.pizzas.forEach(pizza => {
          Object.entries(pizza.ingredientBatchCodes || {}).forEach(([ingredient, code]) => {
            if (code?.trim()) ourCodes[ingredient] = code.trim();
          });
        });
        
        if (existingCodes[id] && existingCodes[id] !== ourCodes[id]) {
          const confirmOverride = window.confirm(
            `Warning: This field was recently updated to "${existingCodes[id]}" by another user. ` +
            `Do you want to override it with "${value}"?`
          );
          if (!confirmOverride) {
            const freshData = { id: currentSnap.id, ...currentData };
            setViewingBatch(freshData);
            return;
          }
        }
      }
  
      if (type === "ingredient") {
        const updatedPizzas = currentData.pizzas.map(pizza => {
          return {
            ...pizza,
            ingredientBatchCodes: {
              ...pizza.ingredientBatchCodes,
              [id]: value // `id` here is the ingredient name
            }
          };
        });
  
        await updateDoc(batchRef, { pizzas: updatedPizzas });
      }
  
      if (type === "batch") {
        await updateDoc(batchRef, {
          [field]: field === "ingredients_ordered" ? !!value : value
        });
      }

      if (type === "pizza") {
        let updatedPizzas;
        const exists = currentData.pizzas.some(p => p.id === id);

        if (exists) {
          updatedPizzas = currentData.pizzas
            .map(pizza => {
              if (pizza.id === id) {
                // If setting quantity to 0 or empty, remove this pizza from array
                const newQty = field === "quantity" ? Number(value) : pizza.quantity;
                if (field === "quantity" && (!value || newQty === 0)) {
                  return null; // Mark for removal
                }
                return {
                  ...pizza,
                  [field]: value === "" ? null : Number(value)
                };
              }
              return pizza;
            })
            .filter(pizza => pizza && (pizza.quantity === undefined || pizza.quantity > 0));
        } else {
          // Add new pizza if not present and quantity > 0
          if (field === "quantity" && Number(value) > 0) {
            const newPizza = pizzas.find(p => p.id === id);
            updatedPizzas = [
              ...currentData.pizzas,
              {
                id: newPizza.id,
                quantity: Number(value),
                quantity_on_order: 0,
                pizza_title: newPizza.pizza_title,
                sleeve: newPizza.sleeve,
                ingredients: newPizza.ingredients,
                ingredientBatchCodes: newPizza.ingredients.reduce((acc, ingredient) => {
                  acc[ingredient] = "";
                  return acc;
                }, {}),
                firstPizzaWeight: null,
                middlePizzaWeight: null,
                lastPizzaWeight: null
              }
            ];
          } else {
            updatedPizzas = [...currentData.pizzas];
          }
        }

        const totalPizzas = updatedPizzas.reduce(
          (sum, pizza) => {
            if (pizza.id === "DOU_A1" || pizza.id === "DOU_A0") return sum;
            return sum + (parseInt(pizza.quantity) || 0);
          },
          0
        );
        await updateDoc(batchRef, { 
          pizzas: updatedPizzas,
          num_pizzas: totalPizzas,
        });
      }
  
      const freshSnap = await getDoc(batchRef);
      const freshData = { id: freshSnap.id, ...freshSnap.data() };
      setViewingBatch(freshData);
    } catch (error) {
      console.error("Error saving inline field:", error);
      alert("Couldn't save your change. Please check your connection.");
    }
  };
  


  // Handle clicks outside the form
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        (formRef.current && !formRef.current.contains(e.target)) ||
        (batchDetailsRef.current && !batchDetailsRef.current.contains(e.target))
      ) {
        // Close editing fields when clicking outside
        setEditingField(null);
        setEditingValue("");
        setShowForm(false);
        setViewingBatch(null);
      }
    };

    if (showForm || viewingBatch) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showForm, viewingBatch]);

  useEffect(() => {
    if (!viewingBatch) return;
  
    const selectedPizzas = viewingBatch.pizzas?.filter(p => p.quantity > 0) || [];
  
    const ingredientQuantities = calculateIngredientQuantities(selectedPizzas);
    const requiredIngredients = Object.keys(ingredientQuantities);
  
    const mergedIngredientCodes = {};
    selectedPizzas.forEach(pizza => {
      Object.entries(pizza.ingredientBatchCodes || {}).forEach(([ingredient, code]) => {
        if (code?.trim()) {
          mergedIngredientCodes[ingredient] = code.trim();
        }
      });
    });
  
    const allFilled =
      requiredIngredients.length > 0 &&
      requiredIngredients.every(
        ingredient =>
          mergedIngredientCodes[ingredient] &&
          mergedIngredientCodes[ingredient].trim() !== ""
      );
  
  
    const shouldBeCompleted = allFilled && !!viewingBatch.pizza_numbers_complete;

    if (viewingBatch.completed !== shouldBeCompleted) {
      const batchRef = doc(db, "batches", viewingBatch.id);
      updateDoc(batchRef, { completed: shouldBeCompleted }).then(async () => {
      const freshSnap = await getDoc(batchRef);
      const freshData = { id: freshSnap.id, ...freshSnap.data() };
      setViewingBatch(freshData);
    
      const querySnapshot = await getDocs(collection(db, "batches"));
      const batchesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBatches(batchesData);
      });
    }
  }, [viewingBatch]);
  

  
  // Get userRole from localStorage
  const [userRole, setUserRole] = useState(() => localStorage.getItem('userRole') || '');

  // Helper function to normalize text for search
  const normalizeForSearch = (text) => {
    if (!text) return "";
    return text.toLowerCase().replace(/[\s\W]/g, ""); // Remove spaces, punctuation, and convert to lowercase
  };

  // Helper function to find matching ingredient batch code for search display
  const getMatchingIngredientCodes = (batch, searchTerm) => {
    if (!searchTerm || !batch.pizzas) return [];
    
    const normalizedSearchTerm = normalizeForSearch(searchTerm);
    
    // First check if batch code or date matches (not ingredient codes)
    const batchMatches = 
      normalizeForSearch(batch.batch_code).includes(normalizedSearchTerm) ||
      normalizeForSearch(formatDateDisplay(batch.batch_date)).includes(normalizedSearchTerm);
    
    if (batchMatches) return []; // Don't show ingredient match if batch info matched
    
    // Find all matching ingredient batch codes
    const matches = [];
    const seenCombos = new Set(); // Prevent duplicates
    
    for (const pizza of batch.pizzas) {
      if (pizza.ingredientBatchCodes && pizza.quantity > 0) { // Only pizzas actually made
        for (const [ingredient, code] of Object.entries(pizza.ingredientBatchCodes)) {
          if (code && normalizeForSearch(code).includes(normalizedSearchTerm)) {
            const combo = `${ingredient}:${code}`;
            if (!seenCombos.has(combo)) {
              // Find all pizzas in this batch that use this ingredient
              const pizzasWithIngredient = batch.pizzas
                .filter(p => p.quantity > 0 && p.ingredients.includes(ingredient))
                .map(p => p.pizza_title);
              
              matches.push({ 
                ingredient, 
                code, 
                pizzas: pizzasWithIngredient 
              });
              seenCombos.add(combo);
            }
          }
        }
      }
    }
    
    return matches;
  };

  // Helper to get week number and year (Saturday to Friday)
  function getWeekYear(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    // Find the previous Saturday (or today if it's Saturday)
    const day = d.getDay(); // 0 = Sunday, 6 = Saturday
    const diffToSaturday = (day + 1) % 7; // Saturday = 6, so (6+1)%7 = 0
    d.setDate(d.getDate() - diffToSaturday);

    // First Saturday of the year
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const yearStartDay = yearStart.getDay();
    const firstSaturday =
      yearStartDay === 6
        ? yearStart
        : new Date(yearStart.setDate(yearStart.getDate() + ((6 - yearStartDay + 7) % 7)));

    // Calculate week number
    const week = Math.floor((d - firstSaturday) / (7 * 24 * 60 * 60 * 1000)) + 1;

    return {
      year: d.getFullYear(),
      week,
    };
  }

  // Combine userRole/week filter and search filter
  const filteredBatches = batches
  .filter(batch => {
    if (userRole === 'admin') return true;
    if (userRole === 'unit') {
      if (!batch.batch_date) return false;
      const today = new Date();
      const { year: thisYear, week: thisWeek } = getWeekYear(today);
      const batchDate = new Date(batch.batch_date);
      const { year: batchYear, week: batchWeek } = getWeekYear(batchDate);

      // Only this current week (Saturday to Friday)
      return batchYear === thisYear && batchWeek === thisWeek;
    }
    return true;
  })
  .filter(batch => {
    const normalizedSearchTerm = normalizeForSearch(searchTerm);
    
    // Search in batch code and date
    const matchesBatchInfo = 
      normalizeForSearch(batch.batch_code).includes(normalizedSearchTerm) ||
      normalizeForSearch(formatDateDisplay(batch.batch_date)).includes(normalizedSearchTerm);
    
    // Search in ingredient batch codes
    const matchesIngredientCodes = batch.pizzas?.some(pizza => 
      Object.values(pizza.ingredientBatchCodes || {}).some(code => 
        normalizeForSearch(code).includes(normalizedSearchTerm)
      )
    );
    
    return matchesBatchInfo || matchesIngredientCodes;
  });
  
  // Add this helper function near the top of your component
  const isMobileOrTablet = () => {
    return window.matchMedia('(max-width: 1024px)').matches;
  };

  return (
    <div className='batchCodes navContent'>
      <h2>BATCHES</h2>
      {/* Only show batch search if not unit and there are batches in the database */}
      {userRole !== 'unit' && batches.length > 0 && (
        <div className="alignRight">
          <input
            type="text"
            placeholder="Search batches or ingredient codes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      )}
      {/* Only show add button if not unit */}
      {userRole !== 'unit' && (
        <button className='button' onClick={handleAddClick}>+</button>
      )}
      {viewingBatch && !showForm && (
        <div className="batchDetails border" ref={batchDetailsRef}>
          <h2>Batch Details</h2>
          <div >
            <p><strong>Batch Code:</strong> {viewingBatch.batch_code}</p>
          </div>
          <div >
            <p><strong>Batch Date:</strong> {formatDateDisplay(viewingBatch.batch_date)}</p>
            <div>
            <div className='dateLabelContainer'>
              <strong>Date Label:</strong>
              <div className='dateLabelContent'>
                <div>{getBatchDate(viewingBatch.batch_date)}</div>
                <div>{getBestBeforeDate(viewingBatch.batch_date)}</div>
              </div>
            </div>
              <strong>Ingredients Ordered:</strong>{" "}
              <input
                type="checkbox"
                checked={ingredientsOrdered || false}
                name='ingredients_ordered'
                onChange={async (e) => {
                  const newValue = e.target.checked;
                  try {
                    await handleInlineSave("batch", null, "ingredients_ordered", newValue);
                    setIngredientsOrdered(newValue);
                  } catch (error) {
                    console.error("Error updating checkbox:", error);
                  }
                }}
              />
            </div>

          </div>
          <div className='pizzaDisplayTitles'> 
            <h4 className='pizzaWeightsOuter'>Pizzas:</h4>
            <h6 className='pizzaWeightsOuter pizzaWeights'>Pizza Weights:</h6>
          </div>
          {sortPizzas(viewingBatch.pizzas.filter(pizza => pizza.quantity > 0)).map(pizza => (
  <div key={pizza.id} className='pizzaDetails'>
  <p>
    <strong>{pizza.pizza_title}</strong>:{" "}
    {editingField === `pizza-${pizza.id}-quantity` ? (
      <input
        type="number"
        className='inputNumber'
        value={editingValue}
        autoFocus
        onChange={(e) => setEditingValue(e.target.value)}
        onBlur={() =>
          handleInlineSave("pizza", pizza.id, "quantity", editingValue)
        }
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            handleInlineSave("pizza", pizza.id, "quantity", editingValue);
          }
        }}
      />
    ) : (
      <span
        onClick={() => {
          setEditingField(`pizza-${pizza.id}-quantity`);
          setEditingValue(pizza.quantity || "");
        }}
      >
        {pizza.quantity}
      </span>
    )}
  </p>

    <div className='pizzaWeightsOuter'>
      <div className='pizzaWeights'>

        {/* First Weight */}
        {editingField === `pizza-${pizza.id}-first` ? (
          <div>
          <strong>First:</strong>
          <input
            type="number"
            className='inputNumber'
            value={editingValue}
            autoFocus
            onChange={(e) => setEditingValue(e.target.value)}
            onBlur={() => handleInlineSave("pizza", pizza.id, "firstPizzaWeight", editingValue)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleInlineSave("pizza", pizza.id, "firstPizzaWeight", editingValue);
            }}
          />
          g
          </div>
        ) : (
          <p onClick={() => {
            setEditingField(`pizza-${pizza.id}-first`);
            setEditingValue(pizza.firstPizzaWeight || "");
          }}>
            <strong>First:</strong> {pizza.firstPizzaWeight || <span style={{ color: 'red' }}>-</span>}g
          </p>
        )}

        {/* Middle Weight */}
        {editingField === `pizza-${pizza.id}-middle` ? (
          <div>
          <strong>Middle:</strong>
          <input
            type="number"
            className='inputNumber'
            value={editingValue}
            autoFocus
            onChange={(e) => setEditingValue(e.target.value)}
            onBlur={() => handleInlineSave("pizza", pizza.id, "middlePizzaWeight", editingValue)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleInlineSave("pizza", pizza.id, "middlePizzaWeight", editingValue);
            }}
          />
          g</div>
        ) : (
          <p onClick={() => {
            setEditingField(`pizza-${pizza.id}-middle`);
            setEditingValue(pizza.middlePizzaWeight || "");
          }}>
            <strong>Middle:</strong> {pizza.middlePizzaWeight || <span style={{ color: 'red' }}>-</span>}g
          </p>
        )}

        {/* Last Weight */}
        {editingField === `pizza-${pizza.id}-last` ? (
          <div>
          <strong>Last:</strong>
          <input
            type="number"
            className='inputNumber'
            value={editingValue}
            autoFocus
            onChange={(e) => setEditingValue(e.target.value)}
            onBlur={() => handleInlineSave("pizza", pizza.id, "lastPizzaWeight", editingValue)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleInlineSave("pizza", pizza.id, "lastPizzaWeight", editingValue);
            }}
          />
          g</div>
        ) : (
          <p onClick={() => {
            setEditingField(`pizza-${pizza.id}-last`);
            setEditingValue(pizza.lastPizzaWeight || "");
          }}>
            <strong>Last:</strong> {pizza.lastPizzaWeight || <span style={{ color: 'red' }}>-</span>}g
          </p>
        )}

          </div>
          </div>
          </div>
        ))}
        {(() => {
        const visiblePizzaIds = viewingBatch.pizzas.map(p => p.id);
        const hiddenPizzas = pizzas.filter(p => !visiblePizzaIds.includes(p.id));

        return hiddenPizzas.length > 0 && (
<div >
{!showPizzaPicker ? (
  <span
    style={{ fontStyle: 'italic', cursor: 'pointer' }}
    onClick={() => setShowPizzaPicker(true)}
  >
    + add a pizza type
  </span>
) : (
  <select
    autoFocus
    value=""
    onChange={(e) => {
      const selectedId = e.target.value;
      if (!selectedId) return;
      handleInlineSave("pizza", selectedId, "quantity", 1);
      setShowPizzaPicker(false);
    }}
    onBlur={() => setShowPizzaPicker(false)} // hide dropdown if user clicks away
  >
    <option value="">Select pizza...</option>
    {sortPizzas(
    pizzas
      .filter(p => !viewingBatch.pizzas.some(v => v.id === p.id)))
      .map(pizza => (
        <option key={pizza.id} value={pizza.id}>
          {pizza.pizza_title}
        </option>
      ))}
  </select>
)}
</div>

        );
      })()}
          <p className='pizzaNumbers'>
            <strong>Pizza numbers complete:</strong>{" "}
            <input
              type="checkbox"
              checked={viewingBatch.pizza_numbers_complete || false}
              onChange={async (e) => {
                const newValue = e.target.checked;
                try {
                  await handleInlineSave("batch", null, "pizza_numbers_complete", newValue);
                } catch (error) {
                  console.error("Error updating checkbox:", error);
                }
              }}
            />
          </p>
          <p className="alignRight"><strong>Total Pizzas:</strong> {viewingBatch.num_pizzas}</p>
          <h4>Batch Codes:</h4>
          <div className='ingredientBatchcodeBox'>
          {sortIngredients(
            ingredients.filter(ingredient =>
              viewingBatch.pizzas.some(pizza => pizza.quantity > 0 && pizza.ingredients.includes(ingredient.name))
            )
          ).map(ingredient => {
              const batchCode = viewingBatch.pizzas
                .flatMap(pizza => pizza.ingredients.includes(ingredient.name) ? pizza.ingredientBatchCodes[ingredient.name] : [])
                .find(code => code);
              const ingredientQuantity = calculateIngredientQuantities(viewingBatch.pizzas)[ingredient.name] || { quantity: 0, unitWeight: 1, unit: '' };
              const numberOfUnits = ingredientQuantity.quantity / ingredientQuantity.unitWeight;
  
              return (
                <div key={ingredient.id} className='ingredient container' style={{ color: batchCode ? 'inherit' : 'red' }}>
                  <p>
                    <strong>{ingredient.name}:</strong>
                    {ingredient.name !== "Flour (Caputo Red)" && ingredient.name !== "Salt" && 
                      ` ${formatQuantity(numberOfUnits)} ${ingredientQuantity.unit}`
                    }
                  </p>
                  {editingField === `ingredient-${ingredient.name}` ? (
                    <div>
                    <input
                      type="text"
                      list={`batch-code-suggestions-${ingredient.name}`}
                      value={editingValue}
                      autoFocus
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={() => handleInlineSave("ingredient", ingredient.name, null, editingValue)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleInlineSave("ingredient", ingredient.name, null, editingValue);
                      }}
                      />
                  <datalist id={`batch-code-suggestions-${ingredient.name}`}>
                    {(batchCodeSuggestions[ingredient.name] || [])
                      .filter(code =>
                        editingValue
                          ? code.toLowerCase().includes(editingValue.toLowerCase())
                          : true
                      )
                      .slice(0, 3) // Limit to 3 suggestions
                      .map(code => (
                        <option key={code} value={code} />
                      ))}
                  </datalist>
                  </div>
                  ) : (
                    <p onClick={() => {
                      setEditingField(`ingredient-${ingredient.name}`);
                      setEditingValue(batchCode || "");
                    }}>
                      {batchCode ? `# ${batchCode}` : <span style={{ color: 'red' }}>-</span>}
                    </p>
                  )}
                </div>
              );
            })}
            
            {/* Vacuum Bags - always shown for every batch */}
            {(() => {
              const vacuumBagsBatchCode = viewingBatch.pizzas
                .flatMap(pizza => pizza.ingredientBatchCodes ? pizza.ingredientBatchCodes['Vacuum Bags'] : [])
                .find(code => code) || '';
              
              return (
                <div key="vacuum-bags" className='ingredient container' style={{ color: vacuumBagsBatchCode ? 'inherit' : 'red' }}>
                  <p>
                    <strong>Vacuum Bags:</strong>
                  </p>
                  {editingField === `ingredient-Vacuum Bags` ? (
                    <div>
                    <input
                      type="text"
                      list={`batch-code-suggestions-Vacuum Bags`}
                      value={editingValue}
                      autoFocus
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={() => handleInlineSave("ingredient", "Vacuum Bags", null, editingValue)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleInlineSave("ingredient", "Vacuum Bags", null, editingValue);
                      }}
                      />
                  <datalist id={`batch-code-suggestions-Vacuum Bags`}>
                    {(batchCodeSuggestions['Vacuum Bags'] || [])
                      .filter(code =>
                        editingValue
                          ? code.toLowerCase().includes(editingValue.toLowerCase())
                          : true
                      )
                      .slice(0, 3)
                      .map(code => (
                        <option key={code} value={code} />
                      ))}
                  </datalist>
                  </div>
                  ) : (
                    <p onClick={() => {
                      setEditingField(`ingredient-Vacuum Bags`);
                      setEditingValue(vacuumBagsBatchCode || "");
                    }}>
                      {vacuumBagsBatchCode ? `# ${vacuumBagsBatchCode}` : <span style={{ color: 'red' }}>-</span>}
                    </p>
                  )}
                </div>
              );
            })()}
            </div>
          <p className='fullWidth'>
          <strong>Notes:</strong>{" "}
          {editingField === "notes" ? (
            <textarea
              value={editingValue}
              autoFocus
              onChange={(e) => setEditingValue(e.target.value)}
              onBlur={() => handleInlineSave("batch", null, "notes", editingValue)}
              onKeyDown={(e) => {
                // Only apply Enter shortcut on desktop (screens wider than 1024px)
                if (!isMobileOrTablet() && e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleInlineSave("batch", null, "notes", editingValue);
                }
              }}
              className='fullWidth minHeight'
              placeholder="..."
            />
          ) : (
            <span 
            className="paragraph"
            onClick={() => {
              setEditingField("notes");
              setEditingValue(viewingBatch.notes || "");
            }}>
              {viewingBatch.notes || <i>+ add notes</i>}
            </span>
          )}
        </p>
        <div className="batchActionButtons container center">
          {userRole !== 'unit' && (
            <button
              type="button"
              className='button draft'
              onClick={() => {
                const confirmed = window.confirm("Are you sure you want to delete this batch?");
                if (confirmed) {
                  handleDeleteForm();
              }
            }}
            >
              Delete batch
            </button>
          )}
          </div>
        </div>
      )}
  
      {showForm && (
        <form
          ref={formRef}
          onSubmit={handleAddFormSubmit}
          className='editForm'
          as={Row}
        >
          <Form.Label column sm={3}><strong>Batch Code:</strong></Form.Label>
          <Col>
            <div># {batchCode}</div>
          </Col>
          <div>
          <Form.Label column sm={3}><strong>Batch Date:</strong></Form.Label>
          <Col>
            <input
              type="date"
              name="batch_date"
              value={batchDate}
              onChange={handleInputChange}
              required
            />
          </Col>
          <Form.Label column sm={3}>
            <strong>Ingredients Ordered?</strong>
            <input
              className='m-2'
              type="checkbox"
              name='ingredients_ordered'
              checked={ingredientsOrdered}
              onChange={handleInputChange}
            />
          </Form.Label>
          </div>
          <Form.Label column sm={3}><strong>Number of Pizzas:</strong></Form.Label>
          <Col>
          {sortPizzas(pizzas).map((pizza) => (
          <div key={pizza.id} className='pizzaDetails'>
            <div className="pizza-info">
              <strong>{pizza.pizza_title}</strong>
              <input
                className='inputNumber'
                type="number"
                name="quantity"
                value={pizza.quantity || ""}
                placeholder='0'
                onChange={(e) => handleQuantityChange(e, pizza.id)}
              />
            </div>
          </div>
        ))}


            <div className='total'>
              <h6><strong>Total: </strong>{totalPizzas}</h6>
            </div>
          </Col>
          <div>
            <Form.Label>Notes</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              name="notes"
              value={notes}
              placeholder="Enter your notes here..."
              onChange={handleInputChange}
            />
          </div>
          <div className='container center'>
              <button
                type="button"
                className='button draft'
                onClick={handleAddFormSubmit}
              >
                Save new batch</button>
          </div>

        </form>
      )}
  
      {filteredBatches.length > 0 && (
        <div className='batchHeader container'>
          <p>Batch Date:</p>
          <p>Ingredients Ordered?</p>
        </div>
      )}

      {filteredBatches.length > 0 ? (
        filteredBatches
        .sort((a, b) => new Date(b.batch_date) - new Date(a.batch_date))
        .slice((currentPage - 1) * batchesPerPage, currentPage * batchesPerPage)
        .map(batch => {
          const matchingIngredients = getMatchingIngredientCodes(batch, searchTerm);
          
          return (
            <div key={batch.id} className={`batchDiv ${batch.completed ? 'completed' : 'draft'}`}>
              <button 
                className={`batchText button ${batch.completed ? 'completed' : 'draft'} ${viewingBatch?.id === batch.id ? 'selected' : ''}`} 
                onClick={() => handleBatchClick(batch)}
                style={{ display: 'flex', flexDirection: 'column', width: '100%' }}
              >
                <div className="container" style={{ width: '100%' }}>
                  <p className='batchTextBoxes'>{formatBatchListDate(batch.batch_date, batch.batch_code, userRole, searchTerm.length > 0)}</p>
                  <p className='batchTextBoxCenter'>{batch.num_pizzas}</p>
                  {batch.ingredients_ordered ? <p className='batchTextBoxEnd'>✓</p> : <p className='batchTextBoxEnd'>✘</p>}
                </div>
                {matchingIngredients.length > 0 && (
                  <div style={{ 
                    width: '100%', 
                    fontSize: '0.8em', 
                    opacity: 0.8, 
                    marginTop: '0.25rem',
                    textAlign: 'left',
                    paddingLeft: '0.5rem'
                  }}>
                    {matchingIngredients.length === 1 ? (
                      <div>
                        {matchingIngredients[0].ingredient}: {matchingIngredients[0].code} → {matchingIngredients[0].pizzas.join(', ')}
                      </div>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                        {matchingIngredients.map((match, index) => (
                          <li key={index}>
                            {match.ingredient}: {match.code} → {match.pizzas.join(', ')}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </button>
            </div>
          );
        })
      ) : (
        <p className='py-3'>
          {batches.length === 0 ? 'Loading batches...' : 'No batches found matching your search.'}
        </p>
      )}
      {/* Pagination: hide for unit userRole */}
      {userRole !== 'unit' && (
        <div className="pagination">
          {getPagination(currentPage, Math.ceil(filteredBatches.length / batchesPerPage)).map((page, idx) =>
            page === '...' ? (
              <span key={`ellipsis-${idx}`} className="page-ellipsis">...</span>
            ) : (
              <button
                key={page}
                className={`page-button ${currentPage === page ? 'active' : ''}`}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
  
}

export default BatchCodes;
