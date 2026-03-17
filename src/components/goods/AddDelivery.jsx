import React, {useState, useEffect} from 'react';
import { collection, addDoc, getDocs } from '@firebase/firestore';
import { db } from '../firebase/firebase';

// Component to render visual packaging indicators
const PackagingIcon = ({ packaging, ingredientName, size = 'normal' }) => {
  const getIconType = (packaging) => {
    const pack = packaging.toLowerCase();
    if (pack.includes('tin') || pack.includes('can')) return 'tin';
    if (pack.includes('box') || pack.includes('packet')) return 'box';
    if (pack.includes('bag')) return 'bag';
    if (pack.includes('sack')) return 'sack';
    if (pack.includes('pack')) return 'pack';
    if (pack.includes('kg')) return 'kg';
    if (pack.includes('bottle')) return 'bottle';
    if (pack.includes('jar')) return 'jar';
    if (pack.includes('bucket')) return 'bucket';
    if (pack.includes('tray')) return 'tray';
    return 'box'; // default
  };

  const getSVGPath = (type, ingredientName) => {
    switch (type) {
      case 'tin':
        return '/Tin.svg';
      case 'box':
        const name = ingredientName.toLowerCase();
        if (name.includes('basil')) return '/box_basil.svg';
        return '/box.svg';
      case 'bag':
        return '/Bag.svg';
      case 'bottle':
        return '/Bottle.svg';
      case 'jar':
        return '/Jar.svg';
      case 'bucket':
        return '/Bucket.svg';
      case 'tray':
        return '/Tray.svg';
      case 'sack': {
        const name = ingredientName.toLowerCase();
        if (name.includes('rye')) return '/Sack_rye.svg';
        if (name.includes('wholemeal')) return '/Sack_rye.svg';
        if (name.includes('caputo') && name.includes('blue')) return '/Sack_blue.svg';
        if (name.includes('caputo') && name.includes('red')) return '/Sack_red.svg';
        return '/Sack_plain.svg'; // default sack
      }
      case 'pack': {
        return '/box.svg'; // fallback to box for other packs
      }
      case 'kg': {
        const name = ingredientName.toLowerCase();
        if (name.includes('onion')) return '/box_onion.svg';
        if (name.includes('pepperoni') || name.includes('pepp')) return '/Pack_pepp.svg';
        if (name.includes('gran duro') || name.includes('gduro') || name.includes('grana duro') || name.includes('duro')) return '/Pack_GDuro.svg';
        if (name.includes('ham')) return '/Pack_ham.svg';
        if (name.includes('chillies')) return '/Sack_chilli.svg';
        return '/box.svg'; // fallback to box for other kg items
      }
      default:
        return '/box.svg';
    }
  };

  const iconType = getIconType(packaging);
  const svgPath = getSVGPath(iconType, ingredientName);
  const isSmall = size === 'small';
  const iconWidth = isSmall ? '20px' : '40px';
  const iconHeight = isSmall ? '25px' : '50px';
  
  return (
    <div style={{ 
      display: 'inline-block', 
      marginRight: '8px',
      verticalAlign: 'middle',
      width: iconWidth,
      height: iconHeight
    }}>
      <img 
        src={svgPath} 
        alt={iconType} 
        style={{ width: iconWidth, height: iconHeight }} 
        title={packaging}
      />
    </div>
  );
};

function AddDelivery({ onDeliveryAdded, onCancel }) {
  const [ingredients, setIngredients] = useState([]);
  const [availableSuppliers, setAvailableSuppliers] = useState([]);
  const [deliveryData, setDeliveryData] = useState({
    deliveryDate: '',
    poNumber: '',
    supplier: '',
    selectedGoods: [],
    deliveryChecksComplete: false,
    staffInitials: ''
  });
  const [batchCodes, setBatchCodes] = useState({});
  const [temperatures, setTemperatures] = useState({});
  const [useByDates, setUseByDates] = useState({});
  const [quantities, setQuantities] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  // Fetch ingredients from Firestore
  useEffect(() => {
    const fetchIngredients = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'ingredients'));
        const ingredientsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setIngredients(ingredientsData);
      } catch (error) {
        console.error("Error fetching ingredients:", error);
      }
    };
    fetchIngredients();
  }, []);

  // Extract unique suppliers from ingredients data
  useEffect(() => {
    const suppliers = [...new Set(
      ingredients
        .map(ingredient => ingredient.supplier)
        .filter(supplier => supplier && supplier.trim() !== '')
    )].sort();
    setAvailableSuppliers(suppliers);
  }, [ingredients]);

  // Auto-select ingredient if there's only one for the selected supplier
  useEffect(() => {
    if (deliveryData.supplier && ingredients.length > 0) {
      const supplierIngredients = ingredients.filter(ingredient => 
        ingredient.supplier === deliveryData.supplier
      );
      
      if (supplierIngredients.length === 1) {
        const singleIngredient = supplierIngredients[0];
        if (!deliveryData.selectedGoods.includes(singleIngredient.name)) {
          setDeliveryData(prev => ({
            ...prev,
            selectedGoods: [singleIngredient.name]
          }));
        }
      }
    }
  }, [deliveryData.supplier, ingredients]);

  const handleGoodsChange = (ingredientName, isChecked) => {
    setFieldErrors({}); // Clear errors when user makes changes
    let updatedSelectedGoods;
    
    if (isChecked) {
      updatedSelectedGoods = [...deliveryData.selectedGoods, ingredientName];
    } else {
      updatedSelectedGoods = deliveryData.selectedGoods.filter(good => good !== ingredientName);
    }
    
    setDeliveryData(prev => ({
      ...prev,
      selectedGoods: updatedSelectedGoods
    }));

    // Initialize batch codes, temperatures, use-by dates, and quantities for newly selected goods
    const newBatchCodes = { ...batchCodes };
    const newTemperatures = { ...temperatures };
    const newUseByDates = { ...useByDates };
    const newQuantities = { ...quantities };
    
    updatedSelectedGoods.forEach(good => {
      const ingredientData = ingredients.find(ing => ing.name === good);
      const packaging = ingredientData?.packaging?.toLowerCase() || '';
      const isVacuumOrDoughBall = packaging.includes('vacuum bag') || packaging.includes('dough ball pouch');
      
      if (!newBatchCodes[good]) {
        newBatchCodes[good] = '';
      }
      
      // Force proper temperature initialization
      if (!newTemperatures[good] || newTemperatures[good] === undefined) {
        newTemperatures[good] = ingredientData?.temp_check ? '' : 'n/a';
        console.log(`Initializing ${good}: temp_check=${ingredientData?.temp_check}, setting temperature to "${newTemperatures[good]}"`);
      }
      
      if (!newQuantities[good]) {
        newQuantities[good] = '';
      }
    });
    
    // Remove data for unselected goods
    Object.keys(newBatchCodes).forEach(good => {
      if (!updatedSelectedGoods.includes(good)) {
        delete newBatchCodes[good];
        delete newTemperatures[good];
        delete newUseByDates[good];
        delete newQuantities[good];
      }
    });
    
    setBatchCodes(newBatchCodes);
    setTemperatures(newTemperatures);
    setUseByDates(newUseByDates);
    setQuantities(newQuantities);
  };

  const handleBatchCodeChange = (ingredient, value) => {
    setFieldErrors({}); // Clear errors when user makes changes
    setBatchCodes(prev => ({
      ...prev,
      [ingredient]: value
    }));
  };

  const handleTemperatureChange = (ingredient, value) => {
    setFieldErrors({}); // Clear errors when user makes changes
    setTemperatures(prev => ({
      ...prev,
      [ingredient]: value
    }));
  };

  const handleUseByDateChange = (ingredient, value) => {
    setFieldErrors({}); // Clear errors when user makes changes
    setUseByDates(prev => ({
      ...prev,
      [ingredient]: value
    }));
  };

  const handleQuantityChange = (ingredient, value) => {
    setFieldErrors({}); // Clear errors when user makes changes
    setQuantities(prev => ({
      ...prev,
      [ingredient]: value
    }));
  };

  // Get ingredient by name to access packaging info
  const getIngredientByName = (name) => {
    return ingredients.find(ingredient => ingredient.name === name);
  };

  // Check if form is complete (for button state - no alerts)
  const isFormComplete = () => {
    if (!deliveryData.deliveryDate || !deliveryData.poNumber.trim() || 
        !deliveryData.supplier || !deliveryData.staffInitials.trim() || 
        !deliveryData.deliveryChecksComplete || deliveryData.selectedGoods.length === 0) {
      return false;
    }

    // Check that all selected goods have required details
    for (const good of deliveryData.selectedGoods) {
      const ingredientData = ingredients.find(ing => ing.name === good);
      const packaging = ingredientData?.packaging?.toLowerCase() || '';
      
      if (!batchCodes[good] || !batchCodes[good].trim() ||
          !quantities[good] || !quantities[good].trim()) {
        return false;
      }
      
      // Temperature validation - for temp_check items need real value, others can have 'n/a'
      const tempValue = temperatures[good];
      if (ingredientData?.temp_check) {
        // Items with temp checking need actual temperature values
        if (!tempValue || !tempValue.trim() || tempValue.trim() === 'n/a') {
          return false;
        }
      } else {
        // Items without temp checking should have 'n/a' or some value
        if (!tempValue || !tempValue.trim()) {
          return false;
        }
      }
      

    }
    return true;
  };

  // Check which fields have errors
  const getFieldErrors = () => {
    const errors = {};
    
    // Check basic delivery info
    if (!deliveryData.deliveryDate) {
      errors.deliveryDate = true;
    }
    if (!deliveryData.poNumber.trim()) {
      errors.poNumber = true;
    }
    if (!deliveryData.supplier) {
      errors.supplier = true;
    }
    if (!deliveryData.staffInitials.trim()) {
      errors.staffInitials = true;
    }
    if (!deliveryData.deliveryChecksComplete) {
      errors.deliveryChecksComplete = true;
    }
    if (deliveryData.selectedGoods.length === 0) {
      errors.selectedGoods = true;
    }

    // Check that all selected goods have required details
    for (const good of deliveryData.selectedGoods) {
      const ingredientData = ingredients.find(ing => ing.name === good);
      const packaging = ingredientData?.packaging?.toLowerCase() || '';
      console.log(`Checking ${good}: packaging="${packaging}", ingredient data:`, ingredientData);
      
      if (!batchCodes[good] || !batchCodes[good].trim()) {
        errors[`batchCode_${good}`] = true;
      }
      if (!quantities[good] || !quantities[good].trim()) {
        errors[`quantity_${good}`] = true;
      }
      // Temperature validation - for temp_check items need real value, others can have 'n/a'
      const tempValue = temperatures[good];
      console.log(`Validating ${good}: tempValue="${tempValue}", temp_check=${ingredientData?.temp_check}`);
      
      if (ingredientData?.temp_check) {
        // Items with temp checking need actual temperature values (numbers)
        if (!tempValue || !tempValue.trim() || tempValue.trim() === 'n/a') {
          errors[`temperature_${good}`] = true;
          console.log(`${good} FAILED: needs real temperature but got "${tempValue}"`);
        }
      } else {
        // Items without temp checking - should have 'n/a', auto-set if missing
        if (!tempValue || tempValue === 'undefined') {
          console.log(`${good} missing temperature, auto-setting to n/a`);
          setTemperatures(prev => ({ ...prev, [good]: 'n/a' }));
          // Don't mark as error if we can auto-fix it
        } else if (!tempValue.trim()) {
          errors[`temperature_${good}`] = true;
          console.log(`${good} FAILED: has empty temperature`);
        }
      }
      
    }

    return errors;
  };

  const handleSaveDelivery = async () => {
    if (isSubmitting) return; // Prevent double submission
    
    console.log('=== DELIVERY SAVE VALIDATION ===');
    console.log('Selected goods:', deliveryData.selectedGoods);
    console.log('Temperatures:', temperatures);
    console.log('Ingredients data:');
    deliveryData.selectedGoods.forEach(good => {
      const ingredientData = ingredients.find(ing => ing.name === good);
      console.log(`${good}: temp_check = ${ingredientData?.temp_check}, temperature = "${temperatures[good]}"`);
    });
    
    const errors = getFieldErrors();
    console.log('Validation errors:', errors);
    
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    
    setFieldErrors({}); // Clear any existing errors
    setIsSubmitting(true);
    try {
      const deliveryRecord = {
        ...deliveryData,
        batchCodes,
        temperatures,
        useByDates,
        quantities,
        dateCreated: new Date()
      };
      
      await addDoc(collection(db, 'deliveries'), deliveryRecord);
      alert('Delivery record saved successfully!');
      onDeliveryAdded(); // Callback to parent component
    } catch (error) {
      console.error("Error saving delivery record:", error);
      alert('Error saving delivery record');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="addDeliveryView">
      <div className="modal-header">
        <h3>Add New Delivery</h3>
      </div>
    <div className="newDeliveryFormContainer">
      
      <form className="newDeliveryForm">
        {/* Delivery Date */}
        <div className="form-group newDeliveryFormGroup">
          <label>Delivery Date: {fieldErrors.deliveryDate && <span style={{color: '#d32f2f'}}>*necessary field</span>}</label>
          <input
            type="date"
            className="form-input"
            value={deliveryData.deliveryDate}
            onChange={(e) => {
              setFieldErrors({}); // Clear errors when user makes changes
              setDeliveryData(prev => ({ ...prev, deliveryDate: e.target.value }))
            }}
          />
        </div>

        {/* PO Number */}
        <div className="form-group newDeliveryFormGroup">
          <label>PO Number: {fieldErrors.poNumber && <span style={{color: '#d32f2f'}}>*necessary field</span>}</label>
          <input
            type="text"
            className="form-input"
            value={deliveryData.poNumber}
            onChange={(e) => {
              setFieldErrors({}); // Clear errors when user makes changes  
              setDeliveryData(prev => ({ ...prev, poNumber: e.target.value }))
            }}
            placeholder="Enter PO number"
          />
        </div>

        {/* Supplier */}
        <div className="form-group newDeliveryFormGroup">
          <label>Supplier: {fieldErrors.supplier && <span style={{color: '#d32f2f'}}>*necessary field</span>}</label>
          <div className="supplierButtons" >
            {availableSuppliers.map(supplier => (
              <button
                key={supplier}
                type="button"
                onClick={() => {
                  setFieldErrors({}); // Clear errors when user makes changes
                  setDeliveryData(prev => ({ ...prev, supplier }))
                }}
                className={`supplierButton ${
                  deliveryData.supplier === supplier ? 'selectedSupplier' : 
                  deliveryData.supplier ? 'notSelectedSupplier' : ''
                }`}
              >
                {supplier}
              </button>
            ))}
            {deliveryData.supplier && (
              <button
                type="button"
                onClick={() => setDeliveryData(prev => ({ ...prev, supplier: '', selectedGoods: [] }))}
                className="clearSupplierButton"
                title="Clear selected supplier"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Product Details for All Filtered Goods */}
        {deliveryData.supplier && (
          <div className="form-group">
            <h4>Product Details: {fieldErrors.selectedGoods && <span style={{color: '#d32f2f'}}>*necessary field - select at least one item</span>}</h4>
            {ingredients
              .filter(ingredient => ingredient.supplier === deliveryData.supplier)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(ingredient => {
                const packaging = ingredient?.packaging || 'units';
                
                return (
                <div 
                  key={ingredient.id} 
                  className="product-details-row"
                  style={{
                    backgroundColor: deliveryData.selectedGoods.includes(ingredient.name) ? '' : 'transparent',
                    borderColor: deliveryData.selectedGoods.includes(ingredient.name) ? '' : 'transparent',
                  }}
                >
                  <div className="product-name" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="checkbox"
                      id={`goods-${ingredient.id}`}
                      checked={deliveryData.selectedGoods.includes(ingredient.name)}
                      onChange={(e) => handleGoodsChange(ingredient.name, e.target.checked)}
                    />
                    {deliveryData.selectedGoods.includes(ingredient.name) && ingredient.packaging && (
                      <PackagingIcon 
                        packaging={ingredient.packaging} 
                        ingredientName={ingredient.name} 
                        size="small" 
                      />
                    )}
                    <div className={deliveryData.selectedGoods.includes(ingredient.name) ? 'selectedGood' : 'notSelectedGood'}>
                      {ingredient.name}
                    </div>
                  </div>
                  {deliveryData.selectedGoods.includes(ingredient.name) && (
                    <div className="product-inputs">
                      <div className="input-group">
                        <label>Quantity ({packaging}): {fieldErrors[`quantity_${ingredient.name}`] && <span style={{color: '#d32f2f'}}>*necessary field</span>}</label>
                        <input
                          type="number"
                          value={quantities[ingredient.name] || ''}
                          onChange={(e) => handleQuantityChange(ingredient.name, e.target.value)}
                          placeholder="Enter qty"
                          className="product-input product-input-number"
                          min="0"
                          step="1"
                        />
                      </div>
                      <div className="input-group">
                        <label>Batch Code: {fieldErrors[`batchCode_${ingredient.name}`] && <span style={{color: '#d32f2f'}}>*necessary field</span>}</label>
                        <input
                          type="text"
                          value={batchCodes[ingredient.name] || ''}
                          onChange={(e) => handleBatchCodeChange(ingredient.name, e.target.value)}
                          placeholder="Enter batch code"
                          className="product-input"
                        />
                      </div>
                      <div className="input-group">
                        <label>Temperature (°C): {fieldErrors[`temperature_${ingredient.name}`] && <span style={{color: '#d32f2f'}}>*necessary field</span>}</label>
                        <input
                          type={ingredient.temp_check ? "number" : "text"}
                          value={temperatures[ingredient.name] || ''}
                          onChange={(e) => handleTemperatureChange(ingredient.name, e.target.value)}
                          placeholder={ingredient.temp_check ? "e.g 4°C" : "n/a"}
                          className="product-input product-input-number"
                          readOnly={!ingredient.temp_check}
                          style={{
                            backgroundColor: ingredient.temp_check ? 'white' : '#f5f5f5',
                            color: ingredient.temp_check ? 'black' : '#666'
                          }}
                        />
                      </div>
                      {!ingredient.name?.toLowerCase().includes('vacuum bags') && 
                       !ingredient.name?.toLowerCase().includes('dough ball pouches') && (
                        <div className="input-group">
                          <label>Use-by/Best Before: </label>
                          <input
                            type="date"
                            value={useByDates[ingredient.name] || ''}
                            onChange={(e) => handleUseByDateChange(ingredient.name, e.target.value)}
                            className="product-input"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
                );
              })}
          </div>
        )}

        {/* Delivery Checks Complete */}
        <div className="form-group checkbox-group">
          <label htmlFor="delivery-checks">Quality Checks: {fieldErrors.deliveryChecksComplete && <span style={{color: '#d32f2f'}}>*necessary field</span>}</label>
          <input
            type="checkbox"
            className='qualityCheck'
            id="delivery-checks"
            checked={deliveryData.deliveryChecksComplete}
            onChange={(e) => {
              setFieldErrors({}); // Clear errors when user makes changes
              setDeliveryData(prev => ({ ...prev, deliveryChecksComplete: e.target.checked }))
            }}
          />
        </div>
        <ul className='qualityChecks'>
            <li>packed to protect the product (no loose deliveries of product are permitted)</li>
            <li>free from any pest infestation</li>
            <li>within shelf life (use by date & best before date)</li>
            <li>in good condition - no visible sign of damage etc</li>
            <li>allergenic ingredients free from damage and sufficiently packaged to prevent contamination</li>
        </ul>

        {/* Staff Initials */}
        <div className="form-group newDeliveryFormGroup">
          <label htmlFor="staff-initials">Checked By: {fieldErrors.staffInitials && <span style={{color: '#d32f2f'}}>*necessary field</span>}</label>
          <input
            type="text"
            className='form-input'
            id="staff-initials"
            value={deliveryData.staffInitials}
            onChange={(e) => {
              setFieldErrors({}); // Clear errors when user makes changes
              setDeliveryData(prev => ({ ...prev, staffInitials: e.target.value.toUpperCase() }))
            }}
            placeholder="Enter initials"
            maxLength="4"
          />
        </div>
      
      <div className="newDeliveryFormFooter">
        <button type="button" className="cancel-btn" onClick={() => {
          setDeliveryData({
            deliveryDate: '',
            poNumber: '',
            supplier: '',
            selectedGoods: [],
            deliveryChecksComplete: false,
            staffInitials: ''
          });
          setBatchCodes({});
          setTemperatures({});
          setUseByDates({});
          setQuantities({});
          setFieldErrors({});
        }}>
          Clear Fields
        </button>
        <button 
          type="button" 
          className={`save-btn button ${isSubmitting ? 'disabled' : ''}`} 
          onClick={handleSaveDelivery}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : 'Save Delivery'}
        </button>
      </div>
      </form>
      
    </div>
    </div>
  );
}

export default AddDelivery;