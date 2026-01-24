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
  
  // Wastage tracking fields
  const [doughBallWastage, setDoughBallWastage] = useState(0);
  const [tomatoBaseWastageOven, setTomatoBaseWastageOven] = useState(0);
  const [tomatoBaseWastageTopping, setTomatoBaseWastageTopping] = useState(0);
  const [toppedPizzaWastage, setToppedPizzaWastage] = useState(0);
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
  const [wastageExpanded, setWastageExpanded] = useState(false);
  const [selectedBatches, setSelectedBatches] = useState(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null);

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

  // CSV Download functionality
  const downloadSelectedBatchesCSV = () => {
    if (selectedBatches.size === 0) {
      alert("Please select at least one batch to download.");
      return;
    }

    const selectedBatchData = batches.filter(batch => selectedBatches.has(batch.id));
    
    // Get unique pizza base IDs (ignoring last character) in sorted order
    const sortedPizzas = sortPizzas(pizzas);
    const baseIds = [...new Set(sortedPizzas.map(pizza => pizza.id.slice(0, -1)))];
    const orderedBaseIds = [];
    
    // Maintain sort order while getting unique base IDs
    sortedPizzas.forEach(pizza => {
      const baseId = pizza.id.slice(0, -1);
      if (!orderedBaseIds.includes(baseId)) {
        orderedBaseIds.push(baseId);
      }
    });
    
    // Create headers with pizza weight columns
    const baseHeaders = [
      'Batch Code', 
      'Total Pizzas',
      'Completed',
      'Ingredients Ordered',
      'Pizza Numbers Complete',
      'Dough Ball Wastage',
      'Tomato Base Wastage (Oven)',
      'Tomato Base Wastage (Topping)',
      'Topped Pizza Wastage',
      'Total Wastage',
      'Wastage Notes',
      'Notes',
      'Pizza Details'
    ];
    
    const pizzaWeightHeaders = orderedBaseIds.map(baseId => `${baseId} Avg Weight (g)`);
    
    const headers = [
      ...baseHeaders,
      ...pizzaWeightHeaders,
      'Ingredient Batch Codes'
    ];

    // Create CSV rows
    const rows = selectedBatchData.map(batch => {
      const totalWastage = (batch.dough_ball_wastage || 0) + 
                          (batch.tomato_base_wastage_oven || 0) + 
                          (batch.tomato_base_wastage_topping || 0) + 
                          (batch.topped_pizza_wastage || 0);
      
      const pizzaDetails = batch.pizzas?.map(pizza => 
        `${pizza.pizza_title}: ${pizza.quantity} (First: ${pizza.firstPizzaWeight || '-'}g, Middle: ${pizza.middlePizzaWeight || '-'}g, Last: ${pizza.lastPizzaWeight || '-'}g)`
      ).join('; ') || '';
      
      // Calculate average weights for each base pizza type
      const pizzaWeightData = orderedBaseIds.map(baseId => {
        const matchingPizzas = batch.pizzas?.filter(pizza => pizza.id.slice(0, -1) === baseId) || [];
        
        if (matchingPizzas.length === 0) {
          return '';
        }
        
        // Collect all weights from all pizzas of this base type
        const allWeights = [];
        matchingPizzas.forEach(pizza => {
          [pizza.firstPizzaWeight, pizza.middlePizzaWeight, pizza.lastPizzaWeight].forEach(weight => {
            if (weight && !isNaN(weight)) {
              allWeights.push(Number(weight));
            }
          });
        });
        
        if (allWeights.length === 0) {
          return '';
        }
        
        const avgWeight = (allWeights.reduce((sum, w) => sum + w, 0) / allWeights.length).toFixed(1);
        return avgWeight;
      });
      
      const ingredientCodes = batch.pizzas?.flatMap(pizza => 
        Object.entries(pizza.ingredientBatchCodes || {}).map(([ingredient, code]) => 
          code ? `${ingredient}: ${code}` : null
        ).filter(Boolean)
      ).join('; ') || '';

      return [
        batch.batch_code || '',
        batch.num_pizzas || 0,
        batch.completed ? 'Yes' : 'No',
        batch.ingredients_ordered ? 'Yes' : 'No', 
        batch.pizza_numbers_complete ? 'Yes' : 'No',
        batch.dough_ball_wastage || 0,
        batch.tomato_base_wastage_oven || 0,
        batch.tomato_base_wastage_topping || 0,
        batch.topped_pizza_wastage || 0,
        totalWastage,
        batch.wastage_notes || '',
        batch.notes || '',
        pizzaDetails,
        ...pizzaWeightData,
        ingredientCodes
      ];
    });

    // Combine headers and rows
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `batches_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleBatchSelection = (batchId, index, isShiftClick = false) => {
    setSelectedBatches(prev => {
      const newSet = new Set(prev);
      
      if (isShiftClick && lastSelectedIndex !== null) {
        // Select range between lastSelectedIndex and current index
        const sortedBatches = filteredBatches
          .sort((a, b) => new Date(b.batch_date) - new Date(a.batch_date))
          .slice((currentPage - 1) * batchesPerPage, currentPage * batchesPerPage);
        
        const startIndex = Math.min(lastSelectedIndex, index);
        const endIndex = Math.max(lastSelectedIndex, index);
        
        for (let i = startIndex; i <= endIndex; i++) {
          if (sortedBatches[i]) {
            newSet.add(sortedBatches[i].id);
          }
        }
      } else {
        // Normal single selection toggle
        if (newSet.has(batchId)) {
          newSet.delete(batchId);
        } else {
          newSet.add(batchId);
        }
      }
      
      setLastSelectedIndex(index);
      return newSet;
    });
  };

  const selectAllBatches = () => {
    const allBatchIds = filteredBatches.map(batch => batch.id);
    setSelectedBatches(new Set(allBatchIds));
  };

  const clearSelection = () => {
    setSelectedBatches(new Set());
    setLastSelectedIndex(null);
  };

  const calculateSelectedBatchesIngredients = () => {
    if (selectedBatches.size === 0) {
      alert("Please select at least one batch to calculate ingredients.");
      return;
    }

    const selectedBatchData = batches.filter(batch => selectedBatches.has(batch.id));
    
    // Collect all pizzas from selected batches
    const allPizzas = selectedBatchData.flatMap(batch => 
      batch.pizzas?.filter(pizza => pizza.quantity > 0) || []
    );
    
    if (allPizzas.length === 0) {
      alert("No pizzas found in selected batches.");
      return;
    }

    // Calculate total ingredient quantities using existing function logic
    const ingredientQuantities = calculateIngredientQuantities(allPizzas);
    
    // Format results for display
    const results = sortIngredients(
      Object.entries(ingredientQuantities).map(([name, data]) => ({
        name,
        quantity: data.quantity,
        unit: data.unit,
        unitWeight: data.unitWeight
      }))
    );
    
    const totalPizzas = allPizzas.reduce((sum, pizza) => {
      if (pizza.id === "DOU_A1" || pizza.id === "DOU_A0") return sum;
      return sum + (pizza.quantity || 0);
    }, 0);
    
    // Calculate totals by pizza type
    const pizzaTotals = {};
    allPizzas.forEach(pizza => {
      if (pizza.id === "DOU_A1" || pizza.id === "DOU_A0") return;
      const title = pizza.pizza_title;
      pizzaTotals[title] = (pizzaTotals[title] || 0) + pizza.quantity;
    });
    
    // Sort pizza totals by the same order as batches
    const sortedPizzaTotals = Object.entries(pizzaTotals)
      .sort(([titleA], [titleB]) => {
        const pizzaA = pizzas.find(p => p.pizza_title === titleA);
        const pizzaB = pizzas.find(p => p.pizza_title === titleB);
        if (!pizzaA || !pizzaB) return titleA.localeCompare(titleB);
        
        const sortedPizzas = sortPizzas(pizzas);
        const indexA = sortedPizzas.findIndex(p => p.id === pizzaA.id);
        const indexB = sortedPizzas.findIndex(p => p.id === pizzaB.id);
        return indexA - indexB;
      });
    
    // Create HTML content for PDF
    const selectedBatchCodes = selectedBatchData.map(batch => batch.batch_code).join(', ');
    
    const htmlContent = `
      <html>
        <head>
          <title>Ingredients / Bertha's at Home Admin App</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; margin-bottom: 20px; }
            h2 { color: #666; margin-top: 30px; margin-bottom: 15px; }
            .ingredient-list { margin-bottom: 30px; }
            .ingredient-item { margin: 8px 0; padding: 5px; border-bottom: 1px dotted #ccc; }
            .ingredient-name { font-weight: bold; }
            .ingredient-quantity { float: right; }
            .summary { background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin-top: 20px; }
            .batch-codes { font-size: 0.9em; color: #666; margin-bottom: 20px; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <h1>Ingredients</h1>
          <div class="batch-codes">
            <strong>Selected Batches:</strong> ${selectedBatchCodes}
            </div>
            <strong>Total Batches:</strong> ${selectedBatches.size}<br><br>
          <div class="ingredient-list">
            ${results.map(ingredient => {
              const numberOfUnits = ingredient.quantity / ingredient.unitWeight;
              return `
                <div class="ingredient-item">
                  <span class="ingredient-name">${ingredient.name}</span>
                  <span class="ingredient-quantity">${formatQuantity(numberOfUnits)} ${ingredient.unit}</span>
                </div>
              `;
            }).join('')}
          </div>
          <div class="summary">
            ${sortedPizzaTotals.map(([title, count]) => 
              `${title}: ${count}<br>`
            ).join('')}
            <br>
            <strong>Total Pizzas:</strong> ${totalPizzas}<br>
            <br>
            <strong>Generated:</strong> ${new Date().toLocaleDateString('en-GB', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        </body>
      </html>
    `;
    
    // Open new window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

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
  setWastageExpanded(false);
  
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
        dough_ball_wastage: doughBallWastage,
        tomato_base_wastage_oven: tomatoBaseWastageOven,
        tomato_base_wastage_topping: tomatoBaseWastageTopping,
        topped_pizza_wastage: toppedPizzaWastage,
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
          photo: pizza.photo || null,
        })),
        notes: notes,
      });
      setShowForm(false);
      setBatchDate("");
      setBatchCode("");
      setCompleted(false);
      setIngredientsOrdered(false);
      setNotes("")
      setDoughBallWastage(0);
      setTomatoBaseWastageOven(0);
      setTomatoBaseWastageTopping(0);
      setToppedPizzaWastage(0);
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
                  [field]: field === "photo" ? value : (value === "" ? null : Number(value))
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
                lastPizzaWeight: null,
                photo: null
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
  


  // Handle clicks outside the form or modal
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showForm && formRef.current && !formRef.current.contains(e.target)) {
        setEditingField(null);
        setEditingValue("");
        setShowForm(false);
      }
    };

    if (showForm) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showForm]);

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

  // Image compression helper function
  const compressImage = (file, maxWidth = 400, quality = 0.7) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions maintaining aspect ratio
        const aspectRatio = img.width / img.height;
        canvas.width = maxWidth;
        canvas.height = maxWidth / aspectRatio;
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      
      const reader = new FileReader();
      reader.onload = (e) => img.src = e.target.result;
      reader.readAsDataURL(file);
    });
  };

  // Handle photo upload for pizzas
  const handlePhotoUpload = async (pizzaId, file) => {
    if (!file || !file.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      return;
    }

    try {
      // Compress the image
      const compressedImage = await compressImage(file);
      
      // Update the database
      await handleInlineSave("pizza", pizzaId, "photo", compressedImage);
    } catch (error) {
      console.error("Error uploading photo:", error);
      alert("Error uploading photo. Please try again.");
    }
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
      
      {/* Selection controls */}
      {filteredBatches.length > 0 && (
        <div  style={{ display: 'flex', marginBottom: '15px', alignItems: 'start'   }}>
          {!selectionMode ? (
            <button 
              className='button'
              onClick={() => setSelectionMode(true)}
              style={{ fontSize: '12px', padding: '5px 10px'}}
            >
              Select Batches
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button 
                className='button draft'
                onClick={selectAllBatches}
                style={{ fontSize: '12px', padding: '5px 10px' }}
              >
                Select All
              </button>
              <button 
                className='button draft'
                onClick={clearSelection}
                style={{ fontSize: '12px', padding: '5px 10px' }}
              >
                Clear Selection
              </button>
              <button 
                className='button completed'
                onClick={downloadSelectedBatchesCSV}
                disabled={selectedBatches.size === 0}
                style={{ fontSize: '12px', padding: '5px 10px' }}
              >
                Download CSV ({selectedBatches.size})
              </button>
              <button 
                className='button completed'
                onClick={calculateSelectedBatchesIngredients}
                disabled={selectedBatches.size === 0}
                style={{ fontSize: '12px', padding: '5px 10px' }}
              >
                Calculate Ingredients ({selectedBatches.size})
              </button>
              <button 
                className='button draft'
                onClick={() => {
                  setSelectionMode(false);
                  setSelectedBatches(new Set());
                }}
                style={{ fontSize: '12px', padding: '5px 10px' }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
      {viewingBatch && !showForm && (
        <div className="modal-overlay" onClick={() => setViewingBatch(null)}>
          <div className="batchDetails border modal-content" ref={batchDetailsRef} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Batch Details</h2>
              <button 
                className="modal-close-button" 
                onClick={() => setViewingBatch(null)}
                type="button"
              >
                ×
              </button>
            </div>
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
  <div>
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
    {/* Photo Upload Section */}
          <div className='pizzaPhotoSection'>
            <div className='pizzaPhotoContainer'>
              {pizza.photo && (
                <img 
                  src={pizza.photo} 
                  alt={`${pizza.pizza_title} photo`}
                  className='pizzaPhoto'
                  onClick={() => {
                    // Open image in new window for better viewing
                    const newWindow = window.open();
                    newWindow.document.write(`<img src="${pizza.photo}" style="max-width: 100%; max-height: 100vh; object-fit: contain;">`);
                  }}
                />
              )}
              <div className='pizzaPhotoControls'>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      handlePhotoUpload(pizza.id, file);
                    }
                  }}
                  style={{ display: 'none' }}
                  id={`photo-upload-${pizza.id}`}
                />
                {!pizza.photo && (
                  <label 
                    htmlFor={`photo-upload-${pizza.id}`} 
                    className='button pizzaPhotoButton'
                    style={{ fontSize: '12px', padding: '4px 8px' }}
                  >
                    Add Photo
                  </label>
                )}
                {pizza.photo && (
                  <button
                    type="button"
                    className='button draft pizzaPhotoButton'
                    onClick={() => handleInlineSave("pizza", pizza.id, "photo", null)}
                    style={{ fontSize: '12px', padding: '4px 8px' }}
                  >
                    x
                  </button>
                )}
              </div>
            </div>
          </div>
  </div>

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
          
          <p className="alignRight"><strong>Total Pizzas:</strong> {viewingBatch.num_pizzas}</p>
          
          {/* Wastage tracking - collapsible */}
          <div style={{ marginBottom: '15px', alignItems: 'end' }}>
            <p 
              className="alignRight" 
              style={{ cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setWastageExpanded(!wastageExpanded)}
            >
              <strong>Total Wastage:</strong> {
                (viewingBatch.dough_ball_wastage || 0) + 
                (viewingBatch.tomato_base_wastage_oven || 0) + 
                (viewingBatch.tomato_base_wastage_topping || 0) + 
                (viewingBatch.topped_pizza_wastage || 0)
              }{" "}{wastageExpanded ? '⌄' : '>'}
            </p>
            
            {wastageExpanded && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'end', marginTop: '10px' }}>
                <div style={{ maxWidth: '400px', display: 'flex', paddingBottom: '5px', alignItems: 'center' }}>
                  <label style={{ display: 'block', fontSize: '12px' }}>
                    <strong>Dough Ball Wastage:</strong>
                  </label>
                  {editingField === 'wastage-dough-ball' ? (
                    <input
                      type="number"
                      min="0"
                      value={editingValue}
                      autoFocus
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={() => handleInlineSave("batch", null, "dough_ball_wastage", parseInt(editingValue) || 0)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleInlineSave("batch", null, "dough_ball_wastage", parseInt(editingValue) || 0);
                      }}
                      style={{ width: '40px' }}
                    />
                  ) : (
                    <span
                      onClick={() => {
                        setEditingField('wastage-dough-ball');
                        setEditingValue(viewingBatch.dough_ball_wastage || "");
                      }}
                      style={{ cursor: 'pointer', minWidth: '40px', textAlign: 'center', border: '1px solid transparent', padding: '2px' }}
                    >
                      {viewingBatch.dough_ball_wastage || "-"}
                    </span>
                  )}
                </div>
                
                <div style={{ maxWidth: '400px', display: 'flex', paddingBottom: '5px', alignItems: 'center' }}>
                  <label style={{ display: 'block', fontSize: '12px', }}>
                    <strong>Tomato Base Wastage - Oven Side:</strong>
                  </label>
                  {editingField === 'wastage-tomato-oven' ? (
                    <input
                      type="number"
                      min="0"
                      value={editingValue}
                      autoFocus
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={() => handleInlineSave("batch", null, "tomato_base_wastage_oven", parseInt(editingValue) || 0)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleInlineSave("batch", null, "tomato_base_wastage_oven", parseInt(editingValue) || 0);
                      }}
                      style={{ width: '40px' }}
                    />
                  ) : (
                    <span
                      onClick={() => {
                        setEditingField('wastage-tomato-oven');
                        setEditingValue(viewingBatch.tomato_base_wastage_oven || "");
                      }}
                      style={{ cursor: 'pointer', minWidth: '40px', textAlign: 'center', border: '1px solid transparent', padding: '2px' }}
                    >
                      {viewingBatch.tomato_base_wastage_oven || "-"}
                    </span>
                  )}
                </div>
                
                <div style={{ maxWidth: '400px', display: 'flex', paddingBottom: '5px', alignItems: 'center'  }}>
                  <label style={{ display: 'block', fontSize: '12px', }}>
                    <strong>Tomato Base Wastage - Topping Side:</strong>
                  </label>
                  {editingField === 'wastage-tomato-topping' ? (
                    <input
                      type="number"
                      min="0"
                      value={editingValue}
                      autoFocus
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={() => handleInlineSave("batch", null, "tomato_base_wastage_topping", parseInt(editingValue) || 0)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleInlineSave("batch", null, "tomato_base_wastage_topping", parseInt(editingValue) || 0);
                      }}
                      style={{ width: '40px' }}
                    />
                  ) : (
                    <span
                      onClick={() => {
                        setEditingField('wastage-tomato-topping');
                        setEditingValue(viewingBatch.tomato_base_wastage_topping || "");
                      }}
                      style={{ cursor: 'pointer', minWidth: '40px', textAlign: 'center', border: '1px solid transparent', padding: '2px' }}
                    >
                      {viewingBatch.tomato_base_wastage_topping || "-"}
                    </span>
                  )}
                </div>
                
                <div style={{ maxWidth: '400px', display: 'flex', paddingBottom: '5px', alignItems: 'center' }}>
                  <label style={{ display: 'block', fontSize: '12px', }}>
                    <strong>Topped Pizza Wastage: </strong>
                  </label>
                  {editingField === 'wastage-topped-pizza' ? (
                    <input
                      type="number"
                      min="0"
                      value={editingValue}
                      autoFocus
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={() => handleInlineSave("batch", null, "topped_pizza_wastage", parseInt(editingValue) || 0)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleInlineSave("batch", null, "topped_pizza_wastage", parseInt(editingValue) || 0);
                      }}
                      style={{ width: '40px' }}
                    />
                  ) : (
                    <span
                      onClick={() => {
                        setEditingField('wastage-topped-pizza');
                        setEditingValue(viewingBatch.topped_pizza_wastage || "");
                      }}
                      style={{ cursor: 'pointer', minWidth: '40px', textAlign: 'center', border: '1px solid transparent', padding: '2px' }}
                    >
                      {viewingBatch.topped_pizza_wastage || "-"}
                    </span>
                  )}
                </div>
                
                <div style={{ maxWidth: '400px', display: 'flex', flexDirection: 'column', paddingBottom: '5px', paddingTop: '10px' }}>
                  <label style={{ display: 'block', fontSize: '12px', marginBottom: '5px' }}>
                    <strong>Wastage Notes:</strong>
                  </label>
                  {editingField === 'wastage-notes' ? (
                    <textarea
                      value={editingValue}
                      autoFocus
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={() => handleInlineSave("batch", null, "wastage_notes", editingValue)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleInlineSave("batch", null, "wastage_notes", editingValue);
                        }
                      }}
                      style={{ width: '100%', minHeight: '60px', padding: '5px', fontSize: '12px' }}
                      placeholder="Add notes about wastage..."
                    />
                  ) : (
                    <span
                      onClick={() => {
                        setEditingField('wastage-notes');
                        setEditingValue(viewingBatch.wastage_notes || "");
                      }}
                      style={{ 
                        cursor: 'pointer', 
                        minHeight: '20px', 
                        padding: '5px', 
                        border: '1px solid transparent', 
                        fontSize: '12px',
                        fontStyle: viewingBatch.wastage_notes ? 'normal' : 'italic',
                        color: viewingBatch.wastage_notes ? 'inherit' : '#888'
                      }}
                    >
                      {viewingBatch.wastage_notes || "Add notes about wastage..."}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

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
                    {ingredient.name !== "Flour (Caputo Red)" && ingredient.name !== "Salt" && ingredient.name !== "Rye Flour" && 
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
          {selectionMode && <p>Select</p>}
          <p>Batch Date:</p>
          <p>Ingredients Ordered?</p>
        </div>
      )}

      {filteredBatches.length > 0 ? (
        filteredBatches
        .sort((a, b) => new Date(b.batch_date) - new Date(a.batch_date))
        .slice((currentPage - 1) * batchesPerPage, currentPage * batchesPerPage)
        .map((batch, index) => {
          const matchingIngredients = getMatchingIngredientCodes(batch, searchTerm);
          
          return (
            <div key={batch.id} className={`batchDiv ${batch.completed ? 'completed' : 'draft'}`}>
              
                {selectionMode && (
                  <input
                    type="checkbox"
                    checked={selectedBatches.has(batch.id)}
                    onChange={(e) => {
                      const isShiftClick = e.nativeEvent.shiftKey;
                      toggleBatchSelection(batch.id, index, isShiftClick);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ marginRight: '10px', transform: 'scale(1.2)' }}
                  />
                )}
                <button 
                  className={`batchText button ${batch.completed ? 'completed' : 'draft'} ${viewingBatch?.id === batch.id ? 'selected' : ''}`} 
                  onClick={() => handleBatchClick(batch)}
                  style={{ display: 'flex', flexDirection: 'column', width: '100%' }}
                >
                <div className="container" style={{ width: '100%' }}>
                  <p className='batchTextBoxes'>{formatBatchListDate(batch.batch_date, batch.batch_code, userRole, searchTerm.length > 0)}</p>
                  <p className='batchTextBoxCenter'>{batch.num_pizzas > 0 ? batch.num_pizzas : ''}</p>
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
