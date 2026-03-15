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
      if (!newBatchCodes[good]) {
        newBatchCodes[good] = '';
      }
      if (!newTemperatures[good]) {
        newTemperatures[good] = '';
      }
      if (!newUseByDates[good]) {
        newUseByDates[good] = '';
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
    setBatchCodes(prev => ({
      ...prev,
      [ingredient]: value
    }));
  };

  const handleTemperatureChange = (ingredient, value) => {
    setTemperatures(prev => ({
      ...prev,
      [ingredient]: value
    }));
  };

  const handleUseByDateChange = (ingredient, value) => {
    setUseByDates(prev => ({
      ...prev,
      [ingredient]: value
    }));
  };

  const handleQuantityChange = (ingredient, value) => {
    setQuantities(prev => ({
      ...prev,
      [ingredient]: value
    }));
  };

  // Get ingredient by name to access packaging info
  const getIngredientByName = (name) => {
    return ingredients.find(ingredient => ingredient.name === name);
  };

  const handleSaveDelivery = async () => {
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
          <label>Delivery Date:</label>
          <input
            type="date"
            className="form-input"
            value={deliveryData.deliveryDate}
            onChange={(e) => setDeliveryData(prev => ({ ...prev, deliveryDate: e.target.value }))}
          />
        </div>

        {/* PO Number */}
        <div className="form-group newDeliveryFormGroup">
          <label>PO Number:</label>
          <input
            type="text"
            className="form-input"
            value={deliveryData.poNumber}
            onChange={(e) => setDeliveryData(prev => ({ ...prev, poNumber: e.target.value }))}
            placeholder="Enter PO number"
          />
        </div>

        {/* Supplier */}
        <div className="form-group newDeliveryFormGroup">
          <label>Supplier:</label>
          <div className="supplierButtons" >
            {availableSuppliers.map(supplier => (
              <button
                key={supplier}
                type="button"
                onClick={() => setDeliveryData(prev => ({ ...prev, supplier }))}
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
            <h4>Product Details:</h4>
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
                        <label>Quantity ({packaging}):</label>
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
                        <label>Batch Code:</label>
                        <input
                          type="text"
                          value={batchCodes[ingredient.name] || ''}
                          onChange={(e) => handleBatchCodeChange(ingredient.name, e.target.value)}
                          placeholder="Enter batch code"
                          className="product-input"
                        />
                      </div>
                      {ingredient.temp_check && (
                        <div className="input-group">
                          <label>Temperature (°C): </label>
                          <input
                            type="number"
                            value={temperatures[ingredient.name] || ''}
                            onChange={(e) => handleTemperatureChange(ingredient.name, e.target.value)}
                            placeholder="e.g 4°C"
                            className="product-input product-input-number"
                          />
                        </div>
                      )}
                      <div className="input-group">
                        <label>Use-by/Best Before:</label>
                        <input
                          type="date"
                          value={useByDates[ingredient.name] || ''}
                          onChange={(e) => handleUseByDateChange(ingredient.name, e.target.value)}
                          className="product-input"
                        />
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
          </div>
        )}

        {/* Delivery Checks Complete */}
        <div className="form-group checkbox-group">
          <label htmlFor="delivery-checks">Quality Checks </label>
          <input
            type="checkbox"
            className='qualityCheck'
            id="delivery-checks"
            checked={deliveryData.deliveryChecksComplete}
            onChange={(e) => setDeliveryData(prev => ({ ...prev, deliveryChecksComplete: e.target.checked }))}
          />
        </div>

        {/* Staff Initials */}
        <div className="form-group newDeliveryFormGroup">
          <label htmlFor="staff-initials">Checked By:</label>
          <input
            type="text"
            className='form-input'
            id="staff-initials"
            value={deliveryData.staffInitials}
            onChange={(e) => setDeliveryData(prev => ({ ...prev, staffInitials: e.target.value.toUpperCase() }))}
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
        }}>
          Clear Fields
        </button>
        <button type="button" className="save-btn button" onClick={handleSaveDelivery}>
          Save Delivery
        </button>
      </div>
      </form>
      
    </div>
    </div>
  );
}

export default AddDelivery;