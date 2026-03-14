import './batchCodes.css'
import React from 'react';
import { db } from '../firebase/firebase';
import { collection, getDoc, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { useState, useEffect, useRef } from 'react';
import { Col, Row, Form } from 'react-bootstrap';
import MixCalculator from './MixCalculator';
import ImageCropModal from './ImageCropModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faPencilAlt, faCube, faCheck, faSave } from '@fortawesome/free-solid-svg-icons';

function BatchCodes() {
  const [batches, setBatches] = useState([]);
  const [pizzas, setPizzas] = useState([]);
  const [orders, setOrders] = useState([]);
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
  const [batchBreakdown, setBatchBreakdown] = useState("");
  const [batchType, setbatchType] = useState("pizzas"); // 'dough balls', 'pizzas', 'starter'
  
  // Wastage tracking fields
  const [doughBallWastage, setDoughBallWastage] = useState(0);
  const [tomatoBaseWastageOven, setTomatoBaseWastageOven] = useState(0);
  const [tomatoBaseWastageTopping, setTomatoBaseWastageTopping] = useState(0);
  const [toppedPizzaWastage, setToppedPizzaWastage] = useState(0);
  
  // Tub display mode for starter feed (mobile responsive)
  const [tubDisplayMode, setTubDisplayMode] = useState('single'); // 'single' or 'double'
  const formRef = useRef(null)
  const [totalPizzas, setTotalPizzas] = useState(0);
  const [selectedPizzas, setSelectedPizzas] = useState([]);
  const [consolidatedIngredients, setConsolidatedIngredients] = useState([]);
  const [ingredientBatchCodes, setIngredientBatchCodes] = useState({});
  const [loading, setLoading] = useState(true);
  const [viewingBatch, setViewingBatch] = useState(null); // Track viewing mode
  const batchDetailsRef = useRef(null);
  
  // Starter batch specific state
  const [starterMixTotals, setStarterMixTotals] = useState({ water: 0, starter: 0, rye: 0, caputo: 0 });
  const [starterIngredientCodes, setStarterIngredientCodes] = useState({});
  const [formMixQuantities, setFormMixQuantities] = useState(null);
  const [showPizzaPicker, setShowPizzaPicker] = useState(false);
  const [batchCodeSuggestions, setBatchCodeSuggestions] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [wastageExpanded, setWastageExpanded] = useState(false);
  const [selectedBatches, setSelectedBatches] = useState(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null);
  const [longPressTimer, setLongPressTimer] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [editingMixQuantities, setEditingMixQuantities] = useState(false);
  const [mixCalculatorInitialized, setMixCalculatorInitialized] = useState(false);
  const [completionChecklist, setCompletionChecklist] = useState({});

  // Photo cropping and editing states
  const [showImageCrop, setShowImageCrop] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState("");
  const [crop, setCrop] = useState({
    width: 150,
    height: 50,
    x: 0,
    y: 0
  });
  const [completedCrop, setCompletedCrop] = useState(null);
  const [rotation, setRotation] = useState(0);
  const [currentPizzaId, setCurrentPizzaId] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(null); // Track which pizza is uploading



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

  // Calendar helper functions
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstDayOfWeek = firstDay.getDay(); // 0 = Sunday
    const daysInMonth = lastDay.getDate();
    
    const days = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const formatDateForComparison = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  };

  const getBatchesForDate = (date) => {
    if (!date) return [];
    const dateStr = formatDateForComparison(date);
    return filteredBatches.filter(batch => 
      formatDateForComparison(batch.batch_date) === dateStr
    );
  };

  const navigateMonth = (direction) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };

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
    
    const pizzaWeightHeaders = orderedBaseIds.flatMap(baseId => [
      `${baseId} First Weight (g)`,
      `${baseId} Middle Weight (g)`,
      `${baseId} Last Weight (g)`
    ]);
    
    const headers = [
      ...baseHeaders,
      ...pizzaWeightHeaders,
      'Pizza Allocations',
      'Ingredient Batch Codes'
    ];

    // Create CSV rows
    const rows = selectedBatchData.map(batch => {
      const totalWastage = (batch.dough_ball_wastage || 0) + 
                          (batch.tomato_base_wastage_oven || 0) + 
                          (batch.tomato_base_wastage_topping || 0) + 
                          (batch.topped_pizza_wastage || 0);
      
      const pizzaDetails = batch.pizzas?.map(pizza => 
        `${pizza.pizza_title}: ${pizza.quantity}`
      ).join('; ') || '';
      
      // Calculate first, middle, last weights for each base pizza type
      const pizzaWeightData = orderedBaseIds.flatMap(baseId => {
        const matchingPizzas = batch.pizzas?.filter(pizza => pizza.id.slice(0, -1) === baseId) || [];
        
        if (matchingPizzas.length === 0) {
          return ['', '', ''];
        }
        
        // Collect all weights from all pizzas of this base type
        const allFirstWeights = [];
        const allMiddleWeights = [];
        const allLastWeights = [];
        
        matchingPizzas.forEach(pizza => {
          if (pizza.firstPizzaWeight && !isNaN(pizza.firstPizzaWeight)) {
            allFirstWeights.push(Number(pizza.firstPizzaWeight));
          }
          if (pizza.middlePizzaWeight && !isNaN(pizza.middlePizzaWeight)) {
            allMiddleWeights.push(Number(pizza.middlePizzaWeight));
          }
          if (pizza.lastPizzaWeight && !isNaN(pizza.lastPizzaWeight)) {
            allLastWeights.push(Number(pizza.lastPizzaWeight));
          }
        });
        
        const avgFirstWeight = allFirstWeights.length > 0 
          ? (allFirstWeights.reduce((sum, w) => sum + w, 0) / allFirstWeights.length).toFixed(1) 
          : '';
        const avgMiddleWeight = allMiddleWeights.length > 0 
          ? (allMiddleWeights.reduce((sum, w) => sum + w, 0) / allMiddleWeights.length).toFixed(1) 
          : '';
        const avgLastWeight = allLastWeights.length > 0 
          ? (allLastWeights.reduce((sum, w) => sum + w, 0) / allLastWeights.length).toFixed(1) 
          : '';
        
        return [avgFirstWeight, avgMiddleWeight, avgLastWeight];
      });
      
      // Build pizza allocation details
      const pizzaAllocations = batch.pizza_allocations?.map(allocation => {
        const order = orders.find(o => o.id === allocation.orderId);
        if (!order) return null;
        
        const customerDisplay = order.sample_customer_name 
          ? `${order.customer_name} (${order.sample_customer_name})`
          : order.customer_name;
          
        return `${customerDisplay} - ${order.delivery_day} - ${allocation.pizzaId} (${allocation.quantity || 1})`;
      }).filter(Boolean).join('; ') || '';
      
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
        pizzaAllocations,
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

  // const markSelectedBatchesIngredientsOrdered = async () => {
  //   if (selectedBatches.size === 0) {
  //     alert("Please select at least one batch to mark ingredients as ordered.");
  //     return;
  //   }

  //   try {
  //     const updatePromises = Array.from(selectedBatches).map(async (batchId) => {
  //       const batchRef = doc(db, "batches", batchId);
  //       await updateDoc(batchRef, {
  //         ingredients_ordered: true
  //       });
  //     });

  //     await Promise.all(updatePromises);
  //     alert(`Marked ingredients as ordered for ${selectedBatches.size} batch(es).`);
      
  //     // Clear selection after successful update
  //     setSelectionMode(false);
  //     setSelectedBatches(new Set());
  //   } catch (error) {
  //     console.error("Error updating batches:", error);
  //     alert("Error marking ingredients as ordered. Please try again.");
  //   }
  // };

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
    
    // Calculate order quantities based on preOrderAmount
    const orderQuantities = {};
    
    allPizzas.forEach(pizza => {
      pizza.ingredients.forEach(ingredientName => {
        const ingredientData = ingredients.find(ing => ing.name === ingredientName);
        
        if (ingredientData && ingredientData.preOrderAmount) {
          if (!orderQuantities[ingredientData.name]) {
            orderQuantities[ingredientData.name] = {
              quantity: 0,
              unit: ingredientData.packaging,
              unitWeight: ingredientData.ratio ? parseFloat(ingredientData.ratio.split(':')[1]) : 1
            };
          }
          // Calculate total order quantity required in grams
          orderQuantities[ingredientData.name].quantity += (ingredientData.preOrderAmount * pizza.quantity);
        }
      });
    });
    
    // Convert order quantities to kilograms
    Object.keys(orderQuantities).forEach(ingredient => {
      orderQuantities[ingredient].quantity /= 1000; // Convert grams to kilograms
    });
    
    // Format results for display
    const results = Object.entries(ingredientQuantities).map(([name, data]) => {
      const ingredientData = ingredients.find(ing => ing.name === name);
      const orderData = orderQuantities[name] || { quantity: 0, unit: data.unit, unitWeight: data.unitWeight };
      return {
        name,
        quantity: data.quantity,
        orderQuantity: orderData.quantity,
        unit: data.unit,
        unitWeight: data.unitWeight,
        supplier: ingredientData?.supplier || ''
      };
    }).sort((a, b) => {
      // Sort by supplier first, then by ingredient name
      const supplierComparison = a.supplier.localeCompare(b.supplier);
      if (supplierComparison !== 0) return supplierComparison;
      return a.name.localeCompare(b.name);
    });
    
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
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Ingredients / Bertha's at Home Admin App</title>
          <style>
            * { box-sizing: border-box; }
            html, body { margin: 0; padding: 0; width: 100%; max-width: 95%; overflow-x: hidden; }
            body { font-family: Arial, sans-serif; margin: 20px; word-wrap: break-word; }
            h1 { color: #333; margin-bottom: 20px; }
            h2 { color: #666; margin-top: 30px; margin-bottom: 15px; }
            .ingredient-list { margin-bottom: 30px; width: 100%; }
            .ingredient-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .ingredient-table th, .ingredient-table td { padding: 8px 12px; text-align: left; border-bottom: 1px dotted #ccc; }
            .ingredient-table th { background-color: #f5f5f5; font-weight: bold; border-bottom: 2px solid #333; }
            .ingredient-table td:nth-child(2), .ingredient-table td:nth-child(3) { text-align: right; }
            .ingredient-table th:nth-child(2), .ingredient-table th:nth-child(3) { text-align: right; }
            .ingredient-table td:nth-child(2) { color: #888888; }
            .ingredient-table .ingredient-order { color: #000000; }
            .summary { background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin-top: 20px; word-wrap: break-word; width: 100%; }
            .batch-codes { font-size: 0.9em; color: #666; margin-bottom: 20px; word-wrap: break-word; width: 100%; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <h1>Ingredients</h1>
          <div class="batch-codes">
            <strong>Selected Batches:</strong> ${selectedBatchCodes}
            </div>
            <strong>Total Batches:</strong> ${selectedBatches.size}<br><br>
          <table class="ingredient-table">
            <thead>
              <tr>
                <th>Ingredient</th>
                <th>Prep Quantity</th>
                <th>Order Quantity</th>
              </tr>
            </thead>
            <tbody>
              ${(() => {
                // Group ingredients by supplier
                const groupedBySupplier = {};
                results.forEach(ingredient => {
                  const supplier = ingredient.supplier || 'No Supplier';
                  if (!groupedBySupplier[supplier]) {
                    groupedBySupplier[supplier] = [];
                  }
                  groupedBySupplier[supplier].push(ingredient);
                });
                
                // Generate HTML with supplier headers
                return Object.entries(groupedBySupplier).map(([supplier, ingredients]) => {
                  const supplierHeader = `
                    <tr style="background-color: #e8e8e8;">
                      <td colspan="3" style="font-weight: bold; padding: 12px 8px; text-align: center; color: #333;">
                        ${supplier}
                      </td>
                    </tr>`;
                  
                  const ingredientRows = ingredients.map(ingredient => {
                    const prepUnits = ingredient.quantity / ingredient.unitWeight;
                    const orderUnits = ingredient.orderQuantity / ingredient.unitWeight;
                    return `
                      <tr>
                        <td>${ingredient.name}</td>
                        <td>${formatQuantity(prepUnits)} ${ingredient.unit}</td>
                        <td class="ingredient-order">${formatQuantity(orderUnits)} ${ingredient.unit}</td>
                      </tr>`;
                  }).join('');
                  
                  return supplierHeader + ingredientRows;
                }).join('');
              })()}
            </tbody>
          </table>
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
    "Flour (Caputo Blue)",
    "Flour (Wholemeal)", 
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
    const startSet = new Set(["Flour (Caputo Blue)", "Flour (Wholemeal)", "Salt", "Rye Flour"]);
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

  // Fetch orders for pizza allocation display
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "orders"));
        const ordersData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setOrders(ordersData);
      } catch (error) {
        console.error("Error fetching orders:", error);
      }
    };
    fetchOrders();
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
  setFormMixQuantities(null); // Clear mix quantities
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
  
  if (batch.batch_type === 'starter') {
    // For starter batches, use ingredient codes directly from batch
    setViewingBatch({
      ...batch,
      ingredientBatchCodes: batch.ingredientBatchCodes || {}
    });
  } else {
    // For pizza/dough ball batches, aggregate from pizzas
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
  }

  setIngredientsOrdered(batch.ingredients_ordered || false);
};

  const handleAddFormSubmit = async (e) => {
    e.preventDefault();
    if (!batchDate) {
      alert("Please select a batch date before saving.");
      return;
    }
    try {
      // Calculate total pizzas including all types
      const totalPizzas = pizzas
        .filter(pizza => pizza.quantity > 0)
        .reduce((sum, pizza) => sum + pizza.quantity, 0);

      // Add new batch
      const batchData = {
        batch_date: batchDate,
        num_pizzas: totalPizzas,
        batch_code: batchCode,
        batch_type: batchType,
        completed: completed,
        ingredients_ordered: ingredientsOrdered,
        pizza_numbers_complete: pizzaNumbersComplete,
        dough_ball_wastage: doughBallWastage,
        tomato_base_wastage_oven: tomatoBaseWastageOven,
        tomato_base_wastage_topping: tomatoBaseWastageTopping,
        topped_pizza_wastage: toppedPizzaWastage,
        notes: notes,
      };
      
      // Add mix quantities for starter batches
      if (batchType === "starter" && formMixQuantities) {
        batchData.mixQuantities = formMixQuantities;
      }
      
      // Add pizzas for non-starter batches
      if (batchType !== "starter") {
        batchData.pizzas = pizzas.filter(pizza => pizza.quantity > 0).map(pizza => ({
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
        }));
      } else {
        // For starter batches, add empty pizzas array
        batchData.pizzas = [];
      }
      
      await addDoc(collection(db, "batches"), batchData);
      setShowForm(false);
      setBatchDate("");
      setBatchCode("");
      setbatchType("pizzas");
      setCompleted(false);
      setIngredientsOrdered(false);
      setNotes("")
      setBatchBreakdown("");
      setDoughBallWastage(0);
      setTomatoBaseWastageOven(0);
      setTomatoBaseWastageTopping(0);
      setToppedPizzaWastage(0);
      setFormMixQuantities(null);
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
      setEditingMixQuantities(false)
      setMixCalculatorInitialized(false)

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
      case "batch_breakdown":
        setBatchBreakdown(value);  // Update state for batch breakdown
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
        if (field === "batch_date") {
          // When batch date changes, also update the batch code
          const newBatchCode = formatDateToBatchCode(value);
          await updateDoc(batchRef, {
            batch_date: value,
            batch_code: newBatchCode
          });
        } else if (field === "ingredientBatchCodes") {
          // Handle starter batch ingredient codes
          let updateData = {
            ingredientBatchCodes: value
          };

          // Check if starter ingredients are being set and add starter_rye/starter_caputo fields
          const ryeFlourCode = value['Rye Flour'];
          const caputoBlueCode = value['Flour (Caputo Blue)'];
          const wholemealCode = value['Flour (Wholemeal)'];
          
          if (ryeFlourCode || caputoBlueCode || wholemealCode) {
            // Add starter codes to batch-level ingredientBatchCodes
            const updatedBatchCodes = { ...value };
            if (ryeFlourCode) updatedBatchCodes['Starter Rye'] = ryeFlourCode;
            if (caputoBlueCode) updatedBatchCodes['Starter Caputo Blue'] = caputoBlueCode;
            if (wholemealCode) updatedBatchCodes['Starter Wholemeal'] = wholemealCode;
            
            updateData.ingredientBatchCodes = updatedBatchCodes;

            // Also update the first pizza's ingredientBatchCodes if pizzas exist
            if (currentData.pizzas && currentData.pizzas.length > 0) {
              const updatedPizzas = [...currentData.pizzas];
              if (updatedPizzas[0]) {
                updatedPizzas[0] = {
                  ...updatedPizzas[0],
                  ingredientBatchCodes: {
                    ...updatedPizzas[0].ingredientBatchCodes,
                    ...(ryeFlourCode && { 'Starter Rye': ryeFlourCode }),
                    ...(caputoBlueCode && { 'Starter Caputo Blue': caputoBlueCode }),
                    ...(wholemealCode && { 'Starter Wholemeal': wholemealCode })
                  }
                };
                updateData.pizzas = updatedPizzas;
              }
            }
          }

          await updateDoc(batchRef, updateData);
        } else if (field === "starter_batch_code") {
          // When starter batch is selected, also pull the rye and caputo codes
          let updateData = {
            [field]: value
          };

          if (value) {
            // Find the selected starter batch
            const selectedStarter = batches.find(batch => 
              batch.batch_type === 'starter' && batch.batch_code === value
            );

            if (selectedStarter && selectedStarter.ingredientBatchCodes) {
              const ryeCode = selectedStarter.ingredientBatchCodes['Rye Flour'];
              const caputoBlueCode = selectedStarter.ingredientBatchCodes['Flour (Caputo Blue)'];
              const wholemealCode = selectedStarter.ingredientBatchCodes['Flour (Wholemeal)'];

              // Add to batch-level ingredientBatchCodes
              if (ryeCode || caputoBlueCode || wholemealCode) {
                const currentIngredientCodes = currentData.ingredientBatchCodes || {};
                updateData.ingredientBatchCodes = {
                  ...currentIngredientCodes,
                  ...(ryeCode && { 'Starter Rye': ryeCode }),
                  ...(caputoBlueCode && { 'Starter Caputo Blue': caputoBlueCode }),
                  ...(wholemealCode && { 'Starter Wholemeal': wholemealCode })
                };

                // Also update first pizza's ingredientBatchCodes if pizzas exist
                if (currentData.pizzas && currentData.pizzas.length > 0) {
                  const updatedPizzas = [...currentData.pizzas];
                  if (updatedPizzas[0]) {
                    updatedPizzas[0] = {
                      ...updatedPizzas[0],
                      ingredientBatchCodes: {
                        ...updatedPizzas[0].ingredientBatchCodes,
                        ...(ryeCode && { 'Starter Rye': ryeCode }),
                        ...(caputoBlueCode && { 'Starter Caputo Blue': caputoBlueCode }),
                        ...(wholemealCode && { 'Starter Wholemeal': wholemealCode })
                      }
                    };
                    updateData.pizzas = updatedPizzas;
                  }
                }
              }
            }
          }

          await updateDoc(batchRef, updateData);
        } else {
          await updateDoc(batchRef, {
            [field]: field === "ingredients_ordered" ? !!value : value
          });
        }
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
            // For dough ball batches, include dough balls in total
            // For pizza batches, exclude dough balls from total
            if ((pizza.id === "DOU_A1" || pizza.id === "DOU_A0") && currentData.batch_type !== "dough balls") {
              return sum;
            }
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
      
      let errorMessage = "Couldn't save your change. Please check your connection.";
      
      // Provide more specific error messages
      if (error.code === 'cancelled' || error.code === 'deadline-exceeded') {
        errorMessage = "Request timed out. Please try again with a smaller image or check your connection.";
      } else if (error.code === 'invalid-argument' && field === 'photo') {
        errorMessage = "Image data is too large. Please try cropping a smaller area or taking a lower resolution photo.";
      } else if (error.code === 'resource-exhausted' || error.message?.includes('size')) {
        errorMessage = "Data is too large to save. Please try with a smaller image.";
      } else if (error.code === 'unavailable' || error.code === 'unauthenticated') {
        errorMessage = "Connection error. Please check your internet and try again.";
      }
      
      alert(errorMessage);
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
  
    // Set starter mix totals for starter batches
    if (viewingBatch.batch_type === 'starter' && viewingBatch.mixQuantities?.totals) {
      setStarterMixTotals(viewingBatch.mixQuantities.totals);
    }

    let shouldBeCompleted = false;
    let newCompletionChecklist = {};

    if (viewingBatch.batch_type === 'starter') {
      // For starter batches, check ingredient batch codes and starter made checkbox
      const requiredIngredients = ['Flour (Caputo Blue)', 'Flour (Wholemeal)'];
      const allIngredientCodesPresent = requiredIngredients.every(ingredient => 
        viewingBatch.ingredientBatchCodes?.[ingredient]?.trim()
      );
      
      newCompletionChecklist = {
        ingredientCodes: allIngredientCodesPresent,
        pizzaNumbersComplete: !!viewingBatch.pizza_numbers_complete,
        sleevePhotos: true, // N/A for starter batches
        pizzaWeights: true  // N/A for starter batches
      };
      
      shouldBeCompleted = allIngredientCodesPresent && !!viewingBatch.pizza_numbers_complete;
    } else {
      // For pizza/dough ball batches, use existing logic plus new checks
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
    
      const allIngredientCodesFilled =
        requiredIngredients.length > 0 &&
        requiredIngredients.every(
          ingredient =>
            mergedIngredientCodes[ingredient] &&
            mergedIngredientCodes[ingredient].trim() !== ""
        );

      // Check vacuum bags for non-starter batches and include in ingredient check
      const vacuumBagsBatchCode = selectedPizzas
        .flatMap(pizza => pizza.ingredientBatchCodes ? pizza.ingredientBatchCodes['Vacuum Bags'] : [])
        .find(code => code) || '';
      const vacuumBagsComplete = vacuumBagsBatchCode && vacuumBagsBatchCode.trim() !== "";
      
      // Include vacuum bags in overall ingredient completion
      const allIngredientsIncludingVacuumBags = allIngredientCodesFilled && vacuumBagsComplete;

      // Check sleeve photos - pizzas with sleeve:true need photos
      const sleevePhotosComplete = selectedPizzas.every(pizza => {
        if (pizza.sleeve) {
          return pizza.photo && pizza.photo.trim() !== "";
        }
        return true; // Non-sleeve pizzas don't need photos
      });

      // Check pizza weights - all pizzas need first, middle, and last weights
      const pizzaWeightsComplete = selectedPizzas.every(pizza => {
        return pizza.firstPizzaWeight && 
               pizza.middlePizzaWeight && 
               pizza.lastPizzaWeight &&
               !isNaN(pizza.firstPizzaWeight) &&
               !isNaN(pizza.middlePizzaWeight) &&
               !isNaN(pizza.lastPizzaWeight);
      });

      newCompletionChecklist = {
        ingredientCodes: allIngredientsIncludingVacuumBags,
        pizzaNumbersComplete: !!viewingBatch.pizza_numbers_complete,
        sleevePhotos: sleevePhotosComplete,
        pizzaWeights: pizzaWeightsComplete
      };
    
      shouldBeCompleted = allIngredientsIncludingVacuumBags && 
                         !!viewingBatch.pizza_numbers_complete &&
                         sleevePhotosComplete &&
                         pizzaWeightsComplete;
    }

    // Update completion checklist state
    setCompletionChecklist(newCompletionChecklist);

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
  

  
  // Completion Checklist Component
  const CompletionChecklist = ({ checklist, batchType }) => {
    if (!checklist) return null;

    const checkItems = [
      {
        key: 'ingredientCodes',
        label: 'Ingredient Batch Codes',
        isComplete: checklist.ingredientCodes,
        applicable: true
      },
      {
        key: 'pizzaNumbersComplete',
        label: batchType === 'starter' ? 'Starter Made' : 'Numbers Complete',
        isComplete: checklist.pizzaNumbersComplete,
        applicable: true
      },
      {
        key: 'sleevePhotos',
        label: 'Sleeve Photos Uploaded',
        isComplete: checklist.sleevePhotos,
        applicable: batchType !== 'starter'
      },
      {
        key: 'pizzaWeights',
        label: batchType === 'dough balls' ? 'Weights Recorded' : 'Pizza Weights Recorded',
        isComplete: checklist.pizzaWeights,
        applicable: batchType !== 'starter'
      }
    ];

    const applicableItems = checkItems.filter(item => item.applicable);
    const completedCount = applicableItems.filter(item => item.isComplete).length;
    const totalCount = applicableItems.length;

    return (
      <div style={{
        backgroundColor: '#f8f9fa',
        border: '1px solid #e9ecef',
        borderRadius: '8px',
        padding: '0 10px',
        maxWidth: '400px'
      }}>
        <div style={{
          fontSize: '16px',
          fontWeight: 'bold',
          marginBottom: '12px',
        }}>
          Batch Completion ({completedCount}/{totalCount})
        </div>
        {applicableItems.map(item => (
          <div key={item.key} style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '8px',
            fontSize: '14px'
          }}>
            <span style={{
              display: 'inline-block',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: item.isComplete ? '#28a745' : '#dc3545',
              color: 'white',
              textAlign: 'center',
              lineHeight: '20px',
              marginRight: '10px',
              fontSize: '12px',
              fontWeight: 'bold'
            }}>
              {item.isComplete ? '✓' : '✗'}
            </span>
            <span style={{
              color: item.isComplete ? '#28a745' : '#dc3545',
              textDecoration: item.isComplete ? 'none' : 'none'
            }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // Get userRole from localStorage
  const [userRole, setUserRole] = useState(() => localStorage.getItem('userRole') || '');

  // Track if selection instruction has been shown
  const [hasSeenSelectionInstruction, setHasSeenSelectionInstruction] = useState(() => 
    localStorage.getItem('hasSeenSelectionInstruction') === 'true'
  );

  // Track if toggle instruction has been shown
  const [hasSeenToggleInstruction, setHasSeenToggleInstruction] = useState(() => 
    localStorage.getItem('hasSeenToggleInstruction') === 'true'
  );

  // Helper function to normalize text for search
  const normalizeForSearch = (text) => {
    if (!text) return "";
    return text.toLowerCase().replace(/[\s\W]/g, ""); // Remove spaces, punctuation, and convert to lowercase
  };

  // Helper function to find matching ingredient batch code for search display
  const getMatchingIngredientCodes = (batch, searchTerm) => {
    if (!searchTerm) return [];
    
    const normalizedSearchTerm = normalizeForSearch(searchTerm);
    
    // First check if batch code or date matches (not ingredient codes)
    const batchMatches = 
      normalizeForSearch(batch.batch_code).includes(normalizedSearchTerm) ||
      normalizeForSearch(formatDateDisplay(batch.batch_date)).includes(normalizedSearchTerm);
    
    if (batchMatches) return []; // Don't show ingredient match if batch info matched
    
    // Find all matching ingredient batch codes
    const matches = [];
    const seenCombos = new Set(); // Prevent duplicates
    
    // Check batch-level ingredient codes (for starters: Starter Rye, Starter Caputo, etc.)
    if (batch.ingredientBatchCodes) {
      for (const [ingredient, code] of Object.entries(batch.ingredientBatchCodes)) {
        if (code && normalizeForSearch(code).includes(normalizedSearchTerm)) {
          const combo = `${ingredient}:${code}`;
          if (!seenCombos.has(combo)) {
            // For Starter Rye and Starter Caputo, show all pizzas in the batch
            // since these starter ingredients are used for all pizzas
            const pizzasForStarterIngredient = (ingredient === 'Starter Rye' || ingredient === 'Starter Caputo') 
              ? batch.pizzas?.filter(p => p.quantity > 0).map(p => p.pizza_title) || []
              : (batch.batch_type === 'starter' ? ['Starter'] : []);
              
            matches.push({ 
              ingredient, 
              code, 
              pizzas: pizzasForStarterIngredient 
            });
            seenCombos.add(combo);
          }
        }
      }
    }
    
    // Check pizza-level ingredient codes
    if (batch.pizzas) {
      for (const pizza of batch.pizzas) {
        if (pizza.ingredientBatchCodes && pizza.quantity > 0) { // Only pizzas actually made
          for (const [ingredient, code] of Object.entries(pizza.ingredientBatchCodes)) {
            if (code && normalizeForSearch(code).includes(normalizedSearchTerm)) {
              const combo = `${ingredient}:${code}`;
              if (!seenCombos.has(combo)) {
                // For Starter Rye and Starter Caputo, show all pizzas in the batch
                const pizzasWithIngredient = (ingredient === 'Starter Rye' || ingredient === 'Starter Caputo')
                  ? batch.pizzas.filter(p => p.quantity > 0).map(p => p.pizza_title)
                  : batch.pizzas
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

  // Helper function to check if batch is from current week
  const isCurrentWeekBatch = (batch) => {
    if (!batch.batch_date) return false;
    const today = new Date();
    const { year: thisYear, week: thisWeek } = getWeekYear(today);
    const batchDate = new Date(batch.batch_date);
    const { year: batchYear, week: batchWeek } = getWeekYear(batchDate);
    return batchYear === thisYear && batchWeek === thisWeek;
  };

  // Combine userRole/week filter and search filter
  const filteredBatches = (batches || [])
  .filter(batch => {
    if (userRole === 'admin') return true;
    if (userRole === 'unit') {
      if (!batch.batch_date) return false;
      const today = new Date();
      const { year: thisYear, week: thisWeek } = getWeekYear(today);
      const batchDate = new Date(batch.batch_date);
      const { year: batchYear, week: batchWeek } = getWeekYear(batchDate);

      // Show current week batches OR incomplete older batches from last month
      const isCurrentWeek = batchYear === thisYear && batchWeek === thisWeek;
      const isIncomplete = !batch.completed;
      const isFutureWeek = batchYear > thisYear || (batchYear === thisYear && batchWeek > thisWeek);
      
      // Don't show future batches
      if (isFutureWeek) return false;
      
      // Check if batch is within the last month
      const oneMonthAgo = new Date(today);
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      const isWithinLastMonth = batchDate >= oneMonthAgo;
      
      return isCurrentWeek || (isIncomplete && isWithinLastMonth);
    }
    return true;
  })
  .filter(batch => {
    const normalizedSearchTerm = normalizeForSearch(searchTerm);
    
    // Search in batch code and date
    const matchesBatchInfo = 
      normalizeForSearch(batch.batch_code).includes(normalizedSearchTerm) ||
      normalizeForSearch(formatDateDisplay(batch.batch_date)).includes(normalizedSearchTerm);
    
    // Search in pizza-level ingredient batch codes
    const matchesIngredientCodes = batch.pizzas?.some(pizza => 
      Object.values(pizza.ingredientBatchCodes || {}).some(code => 
        normalizeForSearch(code).includes(normalizedSearchTerm)
      )
    );
    
    // Search in batch-level ingredient codes (for starters: starter_rye, starter_caputo, etc.)
    const matchesBatchIngredientCodes = batch.ingredientBatchCodes && 
      Object.values(batch.ingredientBatchCodes).some(code => 
        normalizeForSearch(code).includes(normalizedSearchTerm)
      );
    
    return matchesBatchInfo || matchesIngredientCodes || matchesBatchIngredientCodes;
  });
  
  // Add this helper function near the top of your component
  const isMobileOrTablet = () => {
    // Check for touch capability or smaller screens (including tablet landscape)
    return window.matchMedia('(max-width: 1366px)').matches || 
           ('ontouchstart' in window) || 
           (navigator.maxTouchPoints > 0);
  };

  // Enhanced batch click handler for selection
  const handleBatchClickWithSelection = (batch, index, event) => {
    // Only allow selection functionality for admin users
    if (userRole !== 'admin') {
      handleBatchClick(batch);
      return;
    }
    
    // Mark instruction as seen when user first interacts with batches
    if (!hasSeenSelectionInstruction) {
      setHasSeenSelectionInstruction(true);
      localStorage.setItem('hasSeenSelectionInstruction', 'true');
    }

    // Shift+click for range selection (works on all devices)
    if (event.shiftKey) {
      event.preventDefault();
      if (!selectionMode) {
        setSelectionMode(true);
      }
      toggleBatchSelection(batch.id, index, true);
      return;
    }
    
    // If already in selection mode, toggle batch selection with normal click
    if (selectionMode) {
      event.preventDefault();
      toggleBatchSelection(batch.id, index, false);
      return;
    }
    
    // Normal click behavior (open batch details)
    handleBatchClick(batch);
  };

  // Long press handlers (works on all devices) - only for admin users
  const handleTouchStart = (batch, index) => {
    // Only allow selection for admin users
    if (userRole !== 'admin') {
      return;
    }
    
    // Mark instruction as seen when user first interacts with batches
    if (!hasSeenSelectionInstruction) {
      setHasSeenSelectionInstruction(true);
      localStorage.setItem('hasSeenSelectionInstruction', 'true');
    }
    
    const timer = setTimeout(() => {
      if (!selectionMode) {
        setSelectionMode(true);
      }
      toggleBatchSelection(batch.id, index);
      
      // Add haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 800); // 800ms long press (increased from 500ms to be less sensitive)
    
    setLongPressTimer(timer);
  };

  const handleTouchMove = () => {
    // Cancel long press if user is scrolling
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleTouchCancel = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
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

  // Handle initial photo selection - opens crop modal
  const handlePhotoSelect = (pizzaId, file) => {
    if (!file || !file.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      return;
    }

    // Check file size (limit to 10MB to prevent memory issues - lower limit)
    const maxFileSize = 10 * 1024 * 1024; // 10MB (reduced from 20MB)
    if (file.size > maxFileSize) {
      alert('Image file is too large. Please choose a smaller image (under 10MB) or reduce the camera quality in your phone settings.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result);
      setCurrentPizzaId(pizzaId);
      setCrop({
        width: 150,
        height: 50,
        x: 0,
        y: 0
      });
      setCompletedCrop(null);
      setRotation(0);
      setShowImageCrop(true);
    };
    
    reader.onerror = () => {
      alert('Error reading image file. Please try again.');
    };
    
    reader.readAsDataURL(file);
  };

  // Handle final photo upload after cropping
  const handlePhotoUpload = async (imageElement) => {
    if (!completedCrop || !imageElement || !currentPizzaId) return;

    try {
      setUploadingPhoto(currentPizzaId);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Calculate crop dimensions
      const scaleX = imageElement.naturalWidth / imageElement.width;
      const scaleY = imageElement.naturalHeight / imageElement.height;

      let cropWidth = completedCrop.width * scaleX;
      let cropHeight = completedCrop.height * scaleY;

      // Significantly reduce dimensions for smaller file size (like 72dpi equivalent)
      const maxDimension = 600; // Much smaller max dimension
      if (cropWidth > maxDimension || cropHeight > maxDimension) {
        const scaleFactor = Math.min(maxDimension / cropWidth, maxDimension / cropHeight);
        cropWidth *= scaleFactor;
        cropHeight *= scaleFactor;
      }

      // Further reduce if still large (target around 400px max width)
      if (cropWidth > 400) {
        const additionalScale = 400 / cropWidth;
        cropWidth *= additionalScale;
        cropHeight *= additionalScale;
      }

      canvas.width = cropWidth;
      canvas.height = cropHeight;

      // Apply rotation
      if (rotation !== 0) {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        ctx.translate(centerX, centerY);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(-centerX, -centerY);
      }

      ctx.drawImage(
        imageElement,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY,
        0,
        0,
        canvas.width,
        canvas.height
      );

      // Convert to data URL with aggressive compression
      let quality = 0.4; // Start with much lower quality
      let croppedImageData = canvas.toDataURL('image/jpeg', quality);

      // Check size and reduce quality if needed (aim for under 100KB base64)
      const maxSize = 100000; // ~100KB for base64 data (much smaller)
      while (croppedImageData.length > maxSize && quality > 0.1) {
        quality -= 0.05; // Smaller increments for fine control
        croppedImageData = canvas.toDataURL('image/jpeg', quality);
      }

      // If still too large, try WebP format with low quality
      if (croppedImageData.length > maxSize) {
        croppedImageData = canvas.toDataURL('image/webp', 0.3);
      }

      // If WebP still too large, reduce canvas size further
      if (croppedImageData.length > maxSize) {
        const reductionFactor = 0.8;
        const smallerCanvas = document.createElement('canvas');
        const smallerCtx = smallerCanvas.getContext('2d');
        
        smallerCanvas.width = canvas.width * reductionFactor;
        smallerCanvas.height = canvas.height * reductionFactor;
        
        smallerCtx.drawImage(canvas, 0, 0, smallerCanvas.width, smallerCanvas.height);
        croppedImageData = smallerCanvas.toDataURL('image/jpeg', 0.3);
      }

      // Final size check
      if (croppedImageData.length > maxSize) {
        throw new Error('Image is still too large. Please try cropping a much smaller area or using lower camera quality.');
      }
      
      // Update the database with retry logic
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          await handleInlineSave("pizza", currentPizzaId, "photo", croppedImageData);
          break; // Success, exit retry loop
        } catch (saveError) {
          retryCount++;
          console.error(`Photo save attempt ${retryCount} failed:`, saveError);
          
          if (retryCount >= maxRetries) {
            throw new Error(`Failed to upload photo after ${maxRetries} attempts. Please check your connection and try again.`);
          }
          
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        }
      }
      
      // Close modal
      setShowImageCrop(false);
      setCropImageSrc("");
      setCurrentPizzaId(null);
    } catch (error) {
      console.error("Error uploading photo:", error);
      let errorMessage = "Error uploading photo. Please try again.";
      
      if (error.message.includes('too large') || error.message.includes('still too large')) {
        errorMessage = "Photo is too large. Please try cropping a much smaller area or using lower camera quality.";
      } else if (error.message.includes('network')) {
        errorMessage = "Network error. Please check your connection and try again.";
      } else if (error.message.includes('Failed to upload')) {
        errorMessage = error.message;
      }
      
      alert(errorMessage);
    } finally {
      setUploadingPhoto(null);
    }
  };

  return (
    <div className='batchCodes navContent'>
      <h2>BATCHES</h2>
      
      {/* Add button */}
          {userRole !== 'unit' && (
            <button className='button' onClick={handleAddClick}>+</button>
          )}


      {/* Top controls row: View toggle, Search, Add button */}
      {(filteredBatches.length > 0 || userRole !== 'unit') && (
        <div style={{ 
          margin: '15px 0px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap',
          gap: '10px' 
        }}>
          {/* View toggle slider */}
          {filteredBatches.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}>
              <label className="switch" style={{ position: 'relative' }} title="Switch between List and Calendar view">
                <input
                  type="checkbox"
                  checked={viewMode === 'calendar'}
                  onChange={e => {
                    setViewMode(e.target.checked ? 'calendar' : 'list');
                    if (!hasSeenToggleInstruction) {
                      setHasSeenToggleInstruction(true);
                      localStorage.setItem('hasSeenToggleInstruction', 'true');
                    }
                  }}
                />
                <span className="slider round"></span>
              </label>
              {!hasSeenToggleInstruction && viewMode === 'list' && (
                <div style={{
                  position: 'absolute',
                  left: '20px',
                  top: '-20px',
                  fontSize: '12px',
                  color: '#666',
                  fontStyle: 'italic',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  whiteSpace: 'nowrap'
                }}>
                  <span style={{
                  rotate:'270deg'}}>↰</span>
                  <span>Switch to calendar view</span>
                </div>
              )}
            </div>
          )}

          {/* Search box */}
          {userRole !== 'unit' && batches.length > 0 && (
            <input
              type="text"
              placeholder="Search batches or ingredient codes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ flex: '1', maxWidth: '300px', minWidth: '200px' }}
            />
          )}

          
        </div>
      )}

      {/* Calendar month navigation */}
      {viewMode === 'calendar' && filteredBatches.length > 0 && (
        <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px' }}>
          <button 
            onClick={() => navigateMonth(-1)}
            style={{ fontSize: '12px', padding: '5px' }}
          >
            ← 
          </button>
          <h3 style={{ margin: 0, minWidth: '150px', textAlign: 'center' }}>
            {currentMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </h3>
          <button 
            onClick={() => navigateMonth(1)}
            style={{ fontSize: '12px', padding: '5px' }}
          >
             →
          </button>
        </div>
      )}
      
      {/* Selection controls - only for admin users */}
      {userRole === 'admin' && filteredBatches.length > 0 && (
        <div  style={{ display: 'flex', marginBottom: '15px', alignItems: 'start'   }}>
          {!selectionMode ? (
            !hasSeenSelectionInstruction && (
              <div style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
                {isMobileOrTablet() 
                  ? 'Long press on a batch to select' 
                  : 'Shift+click on a batch to select'
                }

              </div>
            )
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
              {/* <button 
                className='button completed'
                onClick={markSelectedBatchesIngredientsOrdered}
                disabled={selectedBatches.size === 0}
                style={{ fontSize: '12px', padding: '5px 10px' }}
              >
                Ingredients Ordered ✓
              </button> */}
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
        <div className="modal-overlay" onClick={() => { setViewingBatch(null); setEditingMixQuantities(false); setMixCalculatorInitialized(false); }}>
          <div className="batchDetails border modal-content" ref={batchDetailsRef} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Batch Details</h2>
              <button 
                className="modal-close-button" 
                onClick={() => { setViewingBatch(null); setEditingMixQuantities(false); setMixCalculatorInitialized(false); }}
                type="button"
              >
                ×
              </button>
            </div>
          <div className='batchDetailsChecklistFlex'>
          <div className='batchDetilsChecklistFlexBox'>
          <div>
            <p><strong>Batch Code:</strong> {viewingBatch.batch_code}</p>
          </div>
          <div >
            <p><strong>Batch Date:</strong>{" "}
            {editingField === "batch-date" ? (
              <input
                type="date"
                value={editingValue}
                autoFocus
                onChange={(e) => setEditingValue(e.target.value)}
                onBlur={() => handleInlineSave("batch", null, "batch_date", editingValue)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleInlineSave("batch", null, "batch_date", editingValue);
                  }
                }}
              />
            ) : (
              <span
                onClick={() => {
                  if (userRole === 'admin') {
                    setEditingField("batch-date");
                    setEditingValue(viewingBatch.batch_date || "");
                  }
                }}
                style={{ 
                  cursor: userRole === 'admin' ? 'pointer' : 'default',
                  textDecoration: userRole === 'admin' ? 'underline' : 'none'
                }}
              >
                {formatDateDisplay(viewingBatch.batch_date)}
              </span>
            )}</p>
            <div>
            {viewingBatch.batch_type !== 'starter' && (
              <div className='dateLabelContainer'>
                <strong>Date Label:</strong>
                <div className='dateLabelContent'>
                  <div className='madeOn'>
                    <div className='madeOnBBF'>Made On:</div>
                    <div>{getBatchDate(viewingBatch.batch_date)}</div>
                  </div>
                  <div className='bestBefore'>
                    <div className='madeOnBBF'>Best Before:</div>
                    <div>{getBestBeforeDate(viewingBatch.batch_date)}</div>
                  </div>
                </div>
              </div>
            )}
            </div>
              {/* <strong>Ingredients Ordered:</strong>{" "}
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
              /> */}
            </div>

          </div>
          <div className='batchDetilsChecklistFlexBox batchChecklistFlex'>
          {/* Completion Checklist */}
          {viewingBatch && (
            <CompletionChecklist checklist={completionChecklist} batchType={viewingBatch.batch_type} />
          )}
          </div>
          </div>
          
          {/* Conditional content based on batch type */}
          {viewingBatch.batch_type === 'starter' ? (
            /* Starter Batch Display */
            <div>
              <div className='pizzaDisplayTitles'> 
                <h4 className='pizzaWeightsOuter'>
                  Mixes: 
                  {userRole !== 'unit' && (
                    <button 
                      onClick={async () => {
                        if (editingMixQuantities) {
                          // Save changes and exit edit mode
                          try {
                            const batchRef = doc(db, "batches", viewingBatch.id);
                            await updateDoc(batchRef, { mixQuantities: formMixQuantities });
                            
                            setViewingBatch(prev => ({
                              ...prev,
                              mixQuantities: formMixQuantities
                            }));
                            
                            setEditingMixQuantities(false);
                            setMixCalculatorInitialized(false);
                          } catch (error) {
                            console.error("Error saving mix quantities:", error);
                            alert("Failed to save mix quantities. Please try again.");
                          }
                        } else {
                          // Enter edit mode
                          setEditingMixQuantities(true);
                          setMixCalculatorInitialized(false);
                        }
                      }}
                      style={{ marginLeft: '10px', fontSize: '14px', padding: '4px 8px' }}
                      className={`button ${editingMixQuantities ? 'completed' : ''}`}
                    >
                      {editingMixQuantities ? (
                        <>
                          <FontAwesomeIcon icon={faSave}/> Save
                        </>
                      ) : (
                        <FontAwesomeIcon icon={faPencilAlt} />
                      )}
                    </button>
                  )}
                </h4>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                {editingMixQuantities ? (
                  <div>
                    <MixCalculator 
                      onTotalsChange={setStarterMixTotals} 
                      batchId={viewingBatch.id}
                      initialQuantities={viewingBatch.mixQuantities}
                      hideResults={true}
                      onQuantitiesChange={(quantities) => {
                        // Store the quantities for saving  
                        setFormMixQuantities(quantities);
                        // Update the totals for live ingredient requirements display
                        if (quantities.totals) {
                          setStarterMixTotals(quantities.totals);
                        }
                      }}
                    />
                  </div>
                ) : (
                  viewingBatch.mixQuantities ? (
                    <div style={{ backgroundColor: '#f5f5f5', padding: '15px', borderRadius: '5px' }}>
                    <div className="mix-display-container">
                      {/* Display Top Up */}
                      {viewingBatch.mixQuantities.fixedQuantities?.['Top up'] > 0 && (
                        <div style={{ marginBottom: '8px' }}>
                          <strong>Top Up:</strong> {viewingBatch.mixQuantities.fixedQuantities['Top up']}
                        </div>
                      )}
                      {/* Display starter percentage */}
                      {viewingBatch.mixQuantities.isThreePercent !== undefined && (
                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                          <em>Starter {viewingBatch.mixQuantities.isThreePercent ? '3%' : '2.5%'}:</em>
                        </div>
                      )}

                      {/* Display Frozen quantities */}
                      <div className='mix-input-row'>
                      <div><strong>Frozen: </strong></div>
                      {Object.entries(viewingBatch.mixQuantities.frozenQuantities || {})
                        .filter(([_, qty]) => qty > 0)
                        .map(([size, qty]) => (
                          <div style={{ marginLeft: '20px' }}>
                            {size} x {qty}
                          </div>
                        ))
                      }
                      </div>
                      
                      {/* Display Restaurant quantities */}
                      <div className='mix-input-row'>
                      <div><strong>Restaurant: </strong></div>
                      {Object.entries(viewingBatch.mixQuantities.restaurantQuantities || {})
                        .filter(([_, qty]) => qty > 0)
                        .map(([size, qty]) => (
                          <div style={{ marginLeft: '20px' }}>
                            {size} x {qty}
                          </div>
                        ))
                      }
                      </div>
                      
                      {/* Display Dough Balls */}
                      {viewingBatch.mixQuantities.fixedQuantities?.['30kg Dough Balls (10%)'] > 0 && (
                        <>
                        <div className='em' >
                          <em>Starter 10%:</em>
                        </div>
                        <div style={{ marginBottom: '8px' }}>
                          <strong>30kg Dough Balls:</strong> {viewingBatch.mixQuantities.fixedQuantities['30kg Dough Balls (10%)']}
                        </div>
                        </>
                      )}
                      

                    </div>
                  </div>
                ) : (
                  <div style={{ fontStyle: 'italic', color: '#666' }}>
                    No mix data recorded for this batch
                  </div>
                )
                )}
              </div>
              
              {(starterMixTotals.water > 0 || starterMixTotals.starter > 0 || starterMixTotals.rye > 0 || starterMixTotals.caputo > 0) && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <h4 style={{ margin: 0 }}>Starter Feed:</h4>

                  </div>
                  <div className='starterFeed'>
                    
                  <div>
                    <div ></div>
                    <div style={{marginTop: '32px'}}><strong>70% Water: </strong></div>
                    <div><strong>19% Starter: </strong></div>
                    <div><strong>50% Caputo Flour: </strong></div>
                    <div><strong>50% Wholemeal Flour: </strong></div>
                    <em className='em'> <strong>total:</strong></em>
                  </div>
                  
                  {/* Single tub column - always show unless on mobile and double mode selected */}
                  {(!isMobileOrTablet() || tubDisplayMode === 'single') && (
                    <div>
                      <button
                        className='button'
                        onClick={() => setTubDisplayMode(tubDisplayMode === 'single' ? 'double' : 'single')}
                        style={{ fontSize: '12px', padding: '4px 8px' }}
                      >
                        <span>1 tub: <FontAwesomeIcon icon={faCube} /></span>
                      </button>
                      <div>{starterMixTotals.water.toLocaleString()}g</div>
                      <div>{starterMixTotals.starter.toLocaleString()}g</div>
                      <div>{starterMixTotals.rye.toLocaleString()}g</div>
                      <div>{starterMixTotals.caputo.toLocaleString()}g</div>
                      <em className='em'>{(starterMixTotals.water + starterMixTotals.starter + starterMixTotals.rye + starterMixTotals.caputo).toLocaleString()}g</em>
                    </div>
                  )}
                  
                  {/* Double tub column - hide on mobile unless double mode selected */}
                  {(!isMobileOrTablet() || tubDisplayMode === 'double') && (
                    <div>
                      <button
                        className='button'
                        onClick={() => setTubDisplayMode(tubDisplayMode === 'single' ? 'double' : 'single')}
                        style={{ fontSize: '12px', padding: '4px 8px' }}
                      >
                        <span>2 tubs: <FontAwesomeIcon icon={faCube} /><FontAwesomeIcon icon={faCube} /></span>
                      </button>
                      <div >{(starterMixTotals.water / 2).toLocaleString()}g</div>
                      <div>{(starterMixTotals.starter / 2).toLocaleString()}g</div>
                      <div>{(starterMixTotals.rye / 2).toLocaleString()}g</div>
                      <div>{(starterMixTotals.caputo / 2).toLocaleString()}g</div>
                      <em className='em'>{(starterMixTotals.water/2 + starterMixTotals.starter/2 + starterMixTotals.rye/2 + starterMixTotals.caputo/2).toLocaleString()}g each</em>
                    </div>
                  )}
                  </div>
                  <em className='em'> *if starter total is larger than 5500g, split it over 2 10L tubs</em>
                </div>
              )}
              
              <p className='pizzaNumbers'>
                <strong>Starter Made:</strong>{" "}
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
              
              <h4>Ingredient Batch Codes:</h4>
              <div className='ingredientBatchcodeBox'>
                {['Flour (Wholemeal)', 'Flour (Caputo Blue)'].map(ingredientName => {
                  const batchCode = viewingBatch.ingredientBatchCodes?.[ingredientName] || '';
                  
                  return (
                    <div key={ingredientName} className='ingredient container' style={{ color: batchCode ? 'inherit' : 'red' }}>
                      <p><strong>{ingredientName}:</strong></p>
                      {editingField === `starter-ingredient-${ingredientName}` ? (
                        <div>
                          <input
                            type="text"
                            list={`batch-code-suggestions-${ingredientName}`}
                            value={editingValue}
                            autoFocus
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={() => {
                              handleInlineSave("batch", null, "ingredientBatchCodes", {
                                ...viewingBatch.ingredientBatchCodes,
                                [ingredientName]: editingValue
                              });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleInlineSave("batch", null, "ingredientBatchCodes", {
                                  ...viewingBatch.ingredientBatchCodes,
                                  [ingredientName]: editingValue
                                });
                              }
                            }}
                          />
                          <datalist id={`batch-code-suggestions-${ingredientName}`}>
                            {(batchCodeSuggestions[ingredientName] || [])
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
                          setEditingField(`starter-ingredient-${ingredientName}`);
                          setEditingValue(batchCode || "");
                        }}>
                          {batchCode ? `# ${batchCode}` : <span style={{ color: 'red' }}>-</span>}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Pizza/Dough Ball Batch Display */
            <div>
              <div className='pizzaDisplayTitles'> 
                <h4 className='pizzaWeightsOuter'>
                  {viewingBatch.batch_type === 'dough balls' ? 'Dough Balls:' : 'Pizzas:'}
                </h4>
                <h6 className='pizzaWeightsOuter pizzaWeights'>
                  {viewingBatch.batch_type === 'dough balls' ? 'Dough Ball Weights:' : 'Pizza Weights:'}
                </h6>
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
    
    {/* 6pk Cases field - only for sleeved pizzas, only show in unit mode if value isn't 0, and only for pizza batches */}
    {pizza.sleeve && (
      userRole !== 'unit' || 
      (pizza.sixpack_cases != null && Number(pizza.sixpack_cases) > 0)
    ) && viewingBatch.batch_type === 'pizzas' && (
      <div style={{ margin: '4px 0 0 18px' }}>
        <span className='pkCases'>6-pack cases x</span>{" "}
        {editingField === `pizza-${pizza.id}-sixpack-cases` && userRole !== 'unit' ? (
          <input
            type="number"
            className='inputNumber pkCases'
            value={editingValue}
            autoFocus
            onChange={(e) => setEditingValue(e.target.value)}
            onBlur={() =>
              handleInlineSave("pizza", pizza.id, "sixpack_cases", editingValue)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleInlineSave("pizza", pizza.id, "sixpack_cases", editingValue);
              }
            }}
          />
        ) : (
          <span
            className='pkCases'
            onClick={() => {
              if (userRole !== 'unit') {
                setEditingField(`pizza-${pizza.id}-sixpack-cases`);
                setEditingValue(pizza.sixpack_cases || "");
              }
            }}
            style={{ 
              cursor: userRole !== 'unit' ? 'pointer' : 'default',
              textDecoration: userRole !== 'unit' ? 'underline' : 'none',
            }}
          >
            {userRole == 'admin'? pizza.sixpack_cases || '0' : pizza.sixpack_cases}
          </span>
        )}
      </div>
    )}
    
    {/* Photo Upload Section */}
          <div className='pizzaPhotoSection'>
            <div className='pizzaPhotoContainer'>
              {pizza.photo && (
                <>
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
                  <button
                    type="button"
                    className='button pizzaPhotoButton deleteAction'
                    onClick={() => handleInlineSave("pizza", pizza.id, "photo", null)}
                    title="Remove photo"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </>
              )}
              <div className='pizzaPhotoControls'>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      handlePhotoSelect(pizza.id, file);
                    }
                    // Reset the input so same file can be selected again
                    e.target.value = '';
                  }}
                  style={{ display: 'none' }}
                  id={`photo-upload-${pizza.id}`}
                />
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  capture="environment"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      handlePhotoSelect(pizza.id, file);
                    }
                    // Reset the input so same file can be selected again
                    e.target.value = '';
                  }}
                  style={{ display: 'none' }}
                  id={`photo-camera-${pizza.id}`}
                />
                {!pizza.photo && (
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    <label 
                      htmlFor={`photo-camera-${pizza.id}`} 
                      className='button pizzaPhotoButton'
                      style={{ fontSize: '10px', padding: '3px 6px' }}
                      title="Take photo with camera"
                    >
                      {uploadingPhoto === pizza.id ? "📷..." : "📷 Camera"}
                    </label>
                    <label 
                      htmlFor={`photo-upload-${pizza.id}`} 
                      className='button pizzaPhotoButton'
                      style={{ fontSize: '10px', padding: '3px 6px' }}
                      title="Choose from photo library"
                    >
                      {uploadingPhoto === pizza.id ? "🖼️..." : "🖼️ Library"}
                    </label>
                  </div>
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
    {viewingBatch.batch_type === 'dough balls' ? '+ Add Dough Ball Type' : 
  viewingBatch.batch_type === 'starter' ? '' : '+ Add a Pizza Type:'}
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
    <option value="">Select...</option>
    {sortPizzas(
    pizzas
      .filter(p => !viewingBatch.pizzas.some(v => v.id === p.id))
      .filter(p => viewingBatch.batch_type === "dough balls" 
        ? (p.id === "DOU_A0" || p.id === "DOU_A1")
        : (p.id !== "DOU_A0" && p.id !== "DOU_A1")))
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
          
          <p className="alignRight"><strong>Total:</strong> {viewingBatch.num_pizzas}</p>
          
          {/* Wastage tracking - collapsible - only for pizzas */}
          {viewingBatch.batch_type === "pizzas" && (
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
          )}
            </div>
          )}
                    {/* Common sections for non-starter batches */}
          {viewingBatch.batch_type !== 'starter' && (
            <div>
              <p className='pizzaNumbers'>
                <strong>              
                  {viewingBatch.batch_type === 'dough balls' ? 'Dough Ball Numbers Complete:' : 'Pizzas Numbers Complete:'}</strong>{" "}
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
              <div className='ingredient container' style={{ 
                color: viewingBatch.starter_batch_code ? 'inherit' : 'red',
                marginBottom: !viewingBatch.starter_batch_code ? '14px' : undefined 
              }}> 
                <div className='starter'><strong>Starter: </strong></div>
                {editingField === 'starter-batch' ? (
                  <select
                    value={editingValue}
                    autoFocus
                    onChange={(e) => setEditingValue(e.target.value)}
                    onBlur={() => handleInlineSave("batch", null, "starter_batch_code", editingValue)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleInlineSave("batch", null, "starter_batch_code", editingValue);
                      }
                    }}
                  >
                    <option value="">Select starter batch...</option>
                    {batches
                      .filter(batch => batch.batch_type === 'starter')
                      .sort((a, b) => new Date(b.batch_date) - new Date(a.batch_date))
                      .map(batch => (
                        <option key={batch.id} value={batch.batch_code}>
                          {batch.batch_code} - {formatDateDisplay(batch.batch_date)}
                        </option>
                      ))}
                  </select>
                ) : (
                  <div className='starter'   onClick={() => {
                    setEditingField('starter-batch');
                    setEditingValue(viewingBatch.starter_batch_code || "");
                  }}>
                    {viewingBatch.starter_batch_code ? `# ${viewingBatch.starter_batch_code}` : <span style={{ color: 'red' }}>-</span>}
                  </div>
                )}
                </div>
                
                {/* Display rye & caputo batch codes from selected starter */}
                {viewingBatch.starter_batch_code && (() => {
                  const selectedStarter = batches.find(batch => 
                    batch.batch_type === 'starter' && batch.batch_code === viewingBatch.starter_batch_code
                  );
                  return selectedStarter ? (
                    <div style={{ marginLeft: '20px', fontSize: '0.9em', marginTop: '5px' }}>
                      {selectedStarter.ingredientBatchCodes?.['Rye Flour'] && (
                        <div style={{ color: '#666' }}>
                          Rye: #{selectedStarter.ingredientBatchCodes['Rye Flour']}
                        </div>
                      )}
                      {selectedStarter.ingredientBatchCodes?.['Flour (Caputo Blue)'] && (
                        <div style={{ color: '#666' }}>
                          Caputo Blue: #{selectedStarter.ingredientBatchCodes['Flour (Caputo Blue)']}
                        </div>
                      )}
                      {selectedStarter.ingredientBatchCodes?.['Flour (Wholemeal)'] && (
                        <div style={{ color: '#666' }}>
                          Wholemeal: #{selectedStarter.ingredientBatchCodes['Flour (Wholemeal)']}
                        </div>
                      )}
                    </div>
                  ) : null;
                })()}
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
                    {ingredient.name !== "Flour (Caputo Blue)" && ingredient.name !== "Flour (Wholemeal)" && ingredient.name !== "Salt" && ingredient.name !== "Rye Flour" && 
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
            
            {/* Vacuum Bags - shown for all batches except starter */}
            {viewingBatch.batch_type !== 'starter' && (() => {
              const vacuumBagsBatchCode = viewingBatch.pizzas
                .flatMap(pizza => pizza.ingredientBatchCodes ? pizza.ingredientBatchCodes['Vacuum Bags'] : [])
                .find(code => code) || '';
              
              return (
                <div key="vacuum-bags" className='ingredient container' style={{ color: vacuumBagsBatchCode ? 'inherit' : 'red' }}>
                  <p>
                    <strong>{viewingBatch.batch_type === 'dough balls' ? 'Packaging Bags:' : 'Vacuum Bags:'}</strong>
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
            </div>
          )}
          
          {/* Notes section for all batch types */}
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
              className='button deleteAction'
              onClick={() => {
                const confirmed = window.confirm("Are you sure you want to delete this batch?");
                if (confirmed) {
                  handleDeleteForm();
              }
            }}
            >
              <FontAwesomeIcon icon={faTrash} />
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
          {/* <Form.Label column sm={3}>
            <strong>Ingredients Ordered?</strong>
            <input
              className='m-2'
              type="checkbox"
              name='ingredients_ordered'
              checked={ingredientsOrdered}
              onChange={handleInputChange}
            />
          </Form.Label> */}
          </div>
          
          <Form.Label column sm={3}><strong>Batch Type:</strong></Form.Label>
          <Col>
            <div>
              <Form.Check
                type="radio"
                id="pizzas-radio"
                name="batchType"
                value="pizzas"
                label="Pizzas"
                checked={batchType === "pizzas"}
                onChange={(e) => setbatchType(e.target.value)}
                inline
              />
              <Form.Check
                type="radio"
                id="dough-balls-radio"
                name="batchType"
                value="dough balls"
                label="Dough Balls"
                checked={batchType === "dough balls"}
                onChange={(e) => setbatchType(e.target.value)}
                inline
              />
              <Form.Check
                type="radio"
                id="starter-radio"
                name="batchType"
                value="starter"
                label="Starter"
                checked={batchType === "starter"}
                onChange={(e) => setbatchType(e.target.value)}
                inline
              />
            </div>
          </Col>
          
          {batchType === "pizzas" && (
            <>
              <Form.Label column sm={3}><strong>Number of Pizzas:</strong></Form.Label>
              <Col>
                {sortPizzas(pizzas).filter(pizza => pizza.id !== "DOU_A0" && pizza.id !== "DOU_A1").map((pizza) => (
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
            </>
          )}
          
          {batchType === "dough balls" && (
            <>
              <Form.Label column sm={3}><strong>Dough Balls:</strong></Form.Label>
              <Col>
                {sortPizzas(pizzas).filter(pizza => pizza.id === "DOU_A0" || pizza.id === "DOU_A1").map((pizza) => (
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
            </>
          )}
          
          {batchType === "starter" && (
            <>
              <Form.Label column sm={3}><strong>Starter:</strong></Form.Label>
              <Col sm={9}>
                <MixCalculator 
                  onTotalsChange={(totals) => {
                    // You can use these totals if needed elsewhere
                    console.log('Mix totals:', totals);
                  }}
                  onQuantitiesChange={(quantities) => {
                    setFormMixQuantities(quantities);
                  }}
                />
              </Col>
            </>
          )}
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
                className='button buttonDraft'
                onClick={handleAddFormSubmit}
              >
                Save new batch</button>
          </div>

        </form>
      )}
  
      {/* Calendar/List View Display */}
      {filteredBatches.length > 0 ? (
        viewMode === 'calendar' ? (
          // Calendar View
          <div className="calendar-container" style={{ marginBottom: '20px' }}>
            <div className="calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px' }}>
              {/* Header row */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} style={{ padding: '2px', textAlign: 'center', fontWeight: 'bold', fontSize: '10px' }}>
                  {day}
                </div>
              ))}
              
              {/* Calendar days */}
              {getDaysInMonth(currentMonth).map((date, index) => {
                const dayBatches = getBatchesForDate(date);
                const isToday = date && formatDateForComparison(date) === formatDateForComparison(new Date());
                
                return (
                  <div 
                    key={index} 
                    className={`calendar-day ${isToday ? 'today' : ''}`}
                    style={{ 
                      minHeight: '80px', 
                      padding: '4px', 
                      backgroundColor: date ? (isToday ? '#e3f2fd' : '#ffffff') : '#f5f5f5',
                      border: '1px solid #ddd',
                      position: 'relative'
                    }}
                  >
                    {date && (
                      <>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '2px' }}>
                          {date.getDate()}
                        </div>
                        {dayBatches.map((batch, batchIndex) => {
                          const matchingIngredients = getMatchingIngredientCodes(batch, searchTerm);
                          return (
                            <div key={batch.id} style={{ marginBottom: '1px' }}>
                              <button
                                className={`button ${new Date(batch.batch_date) < new Date('2026-01-01') ? 'completed' : (batch.completed ? 'completed' : 'draft batchDivDraft')} ${viewingBatch?.id === batch.id ? 'selected' : ''}`}
                                onClick={(e) => handleBatchClickWithSelection(batch, batchIndex, e)}
                                onTouchStart={() => handleTouchStart(batch, batchIndex)}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handleTouchEnd}
                                onTouchCancel={handleTouchCancel}
                                style={{ 
                                  fontSize: '12px', 
                                  padding: '2px 4px', 
                                  width: '100%',
                                  marginBottom: '1px',
                                  display: 'block',
                                  position: 'relative'
                                }}
                              >
                                
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                                  <span className='batchType' style={{ fontSize: '9px', textAlign: 'center'}}>{batch.batch_type ? `${batch.batch_type.toUpperCase()}` : 'PIZZAS'}</span>
                                  <span style={{ fontSize: '9px' }}>{batch.batch_code}</span>
                                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}>
                                    <span>{batch.num_pizzas}</span>
                                    {/* <span>{batch.ingredients_ordered ? '✓' : '✘'}</span> */}
                                  </div>
                                  {userRole === 'admin' && selectionMode && (
                                  <input
                                    type="checkbox"
                                    checked={selectedBatches.has(batch.id)}
                                    onChange={(e) => {
                                      const isShiftClick = e.nativeEvent.shiftKey;
                                      toggleBatchSelection(batch.id, batchIndex, isShiftClick);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ 
                                      transform: 'scale(0.7)'
                                    }}
                                  />
                                )}
                                </div>
                                {matchingIngredients.length > 0 && (
                                  <div style={{ fontSize: '8px', opacity: 0.8, textAlign: 'center', marginTop: '1px' }}>
                                    {matchingIngredients[0].ingredient}: {matchingIngredients[0].code}
                                  </div>
                                )}
                                
                              </button>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          // List View (existing code)
          <>
            {/* Batch header */}
            {/* <div className='batchHeader container'>
              <p>Batch Date:</p>
              <p>Ingredients Ordered?</p>
            </div> */}
            
            {(() => {
              const sortedBatches = filteredBatches.sort((a, b) => {
                // For unit users, sort current week first, then older incomplete batches
                if (userRole === 'unit') {
                  const aIsCurrent = isCurrentWeekBatch(a);
                  const bIsCurrent = isCurrentWeekBatch(b);
                  
                  if (aIsCurrent && !bIsCurrent) return -1;
                  if (!aIsCurrent && bIsCurrent) return 1;
                  
                  // Within same category, sort by date (newest first)
                  return new Date(b.batch_date) - new Date(a.batch_date);
                }
                // For admin users, just sort by date
                return new Date(b.batch_date) - new Date(a.batch_date);
              });

              const paginatedBatches = sortedBatches.slice((currentPage - 1) * batchesPerPage, currentPage * batchesPerPage);
              
              // Check if there are any incomplete batches from previous weeks
              const hasIncompleteBatches = userRole === 'unit' && paginatedBatches.some(batch => !isCurrentWeekBatch(batch));
              let hasShownSeparator = false;
              
              return paginatedBatches.map((batch, index) => {
                const matchingIngredients = getMatchingIngredientCodes(batch, searchTerm);
                const isCurrentWeek = isCurrentWeekBatch(batch);
                const showSeparator = hasIncompleteBatches && !hasShownSeparator && !isCurrentWeek;
                
                if (showSeparator) {
                  hasShownSeparator = true;
                }
                
                return (
                  <React.Fragment key={batch.id}>
                    {showSeparator && (
                      <div style={{ 
                        borderTop: '1px solid var(--darkGrey)', 
                        borderRadius: '0',
                        margin: '15px 7px', 
                        paddingTop: '15px',
                        fontSize: '12px',
                        color: 'var(--darkGrey)',
                        fontStyle: 'italic',
                        textAlign: 'center'
                      }}>
                        Incomplete batches:
                      </div>
                    )}
                  <div key={batch.id} className={`batchDiv ${new Date(batch.batch_date) < new Date('2026-01-01') ? 'completed' : (batch.completed ? 'completed' : 'draft batchDivDraft')}`}>
                      {userRole === 'admin' && selectionMode && (
                        <input
                          type="checkbox"
                          checked={selectedBatches.has(batch.id)}
                          onChange={(e) => {
                            const isShiftClick = e.nativeEvent.shiftKey;
                            toggleBatchSelection(batch.id, index, isShiftClick);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          style={{ 
                            transform: 'scale(1.2)',
                          }}
                        />
                      )}
                      <button 
                        className={`batchText button ${new Date(batch.batch_date) < new Date('2026-01-01') ? 'completed' : (batch.completed ? 'completed' : 'draft')} ${viewingBatch?.id === batch.id ? 'selected' : ''}`} 
                        onClick={(e) => handleBatchClickWithSelection(batch, index, e)}
                        onTouchStart={() => handleTouchStart(batch, index)}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        onTouchCancel={handleTouchCancel}
                        style={{ display: 'flex', flexDirection: 'column', width: '100%', position: 'relative' }}
                      >
                      {/* <span className='batchType'>{(batch.batch_type || 'PIZZAS').toUpperCase()}</span> */}
                      <div className="container" style={{ width: '100%' }}>
                        <p className='batchTextBoxes batchTextBoxesMobileFont'>
                          {formatBatchListDate(batch.batch_date, batch.batch_code, userRole, searchTerm.length > 0)}</p>
                        <p className='batchTextBoxes batchTextBoxCenter'> {batch.num_pizzas}</p>
                        <p className='batchTextBoxes batchTextBoxEnd batchTextBoxesMobileFont'>{(batch.batch_type || 'PIZZAS').toUpperCase()}</p>
                        {/* {batch.ingredients_ordered ? <p className='batchTextBoxEnd'>✓</p> : <p className='batchTextBoxEnd'>✘</p>} */}
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
                </React.Fragment>
                );
              });
            })()}
          </>
        )
      ) : (
        <p className='py-3'>
          {batches.length === 0 ? 'Loading batches...' : 'No batches found matching your search.'}
        </p>
      )}
      {/* Pagination: hide for unit userRole and calendar view */}
      {userRole !== 'unit' && viewMode === 'list' && filteredBatches.length > 0 && (
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

      <ImageCropModal
        showImageCrop={showImageCrop}
        cropImageSrc={cropImageSrc}
        crop={crop}
        setCrop={setCrop}
        completedCrop={completedCrop}
        setCompletedCrop={setCompletedCrop}
        rotation={rotation}
        setRotation={setRotation}
        uploadingPhoto={uploadingPhoto}
        onCancel={() => {
          setShowImageCrop(false);
          setCropImageSrc("");
          setCurrentPizzaId(null);
        }}
        onUpload={handlePhotoUpload}
      />
    </div>
  );
  
}

export default BatchCodes;
