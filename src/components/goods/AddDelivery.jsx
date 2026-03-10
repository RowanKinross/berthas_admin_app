import React, {useState, useEffect} from 'react';
import { collection, addDoc, getDocs } from '@firebase/firestore';
import { db } from '../firebase/firebase';

function AddDelivery({ onDeliveryAdded, onCancel }) {
  const [ingredients, setIngredients] = useState([]);
  const [availableSuppliers, setAvailableSuppliers] = useState([]);
  const [deliveryData, setDeliveryData] = useState({
    deliveryDate: '',
    poNumber: '',
    supplier: '',
    selectedGoods: [],
    deliveryChecksComplete: false
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
                onClick={() => setDeliveryData(prev => ({ ...prev, supplier: '' }))}
                className="clearSupplierButton"
                title="Clear selected supplier"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Goods Selection */}
        <div className="form-group newDeliveryFormGroup">
          <label>Goods:</label>
          <div className="goods-checkbox-container">
            {ingredients
              .filter(ingredient => deliveryData.supplier && ingredient.supplier === deliveryData.supplier)
              .map(ingredient => (
              <div key={ingredient.id} className="goods-checkbox-item">
                <input
                  type="checkbox"
                  id={`goods-${ingredient.id}`}
                  checked={deliveryData.selectedGoods.includes(ingredient.name)}
                  onChange={(e) => handleGoodsChange(ingredient.name, e.target.checked)}
                />
                <label htmlFor={`goods-${ingredient.id}`}>{ingredient.name}</label>
              </div>
            ))}
          </div>
        </div>

        {/* Product Details for Selected Goods */}
        {deliveryData.selectedGoods.length > 0 && (
          <div className="form-group">
            <h4>Product Details:</h4>
            {deliveryData.selectedGoods.map(good => {
              const ingredient = getIngredientByName(good);
              const packaging = ingredient?.packaging || 'units';
              
              return (
              <div key={good} className="product-details-row">
                <div className="product-name">
                  <strong>{good}</strong>
                </div>
                <div className="product-inputs">
                  <div className="input-group">
                    <label>Quantity ({packaging}):</label>
                    <input
                      type="number"
                      value={quantities[good] || ''}
                      onChange={(e) => handleQuantityChange(good, e.target.value)}
                      placeholder="Enter quantity"
                      className="product-input"
                      min="0"
                      step="1"
                    />
                  </div>
                  <div className="input-group">
                    <label>Batch Code:</label>
                    <input
                      type="text"
                      value={batchCodes[good] || ''}
                      onChange={(e) => handleBatchCodeChange(good, e.target.value)}
                      placeholder="Enter batch code"
                      className="product-input"
                    />
                  </div>
                  <div className="input-group">
                    <label>Temperature:</label>
                    <input
                      type="text"
                      value={temperatures[good] || ''}
                      onChange={(e) => handleTemperatureChange(good, e.target.value)}
                      placeholder="e.g., 4°C"
                      className="product-input"
                    />
                  </div>
                  <div className="input-group">
                    <label>Use-by/Best Before:</label>
                    <input
                      type="date"
                      value={useByDates[good] || ''}
                      onChange={(e) => handleUseByDateChange(good, e.target.value)}
                      className="product-input"
                    />
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}

        {/* Delivery Checks Complete */}
        <div className="form-group checkbox-group">
          <label htmlFor="delivery-checks">Quality Checked? </label>
          <input
            type="checkbox"
            className='qualityCheck'
            id="delivery-checks"
            checked={deliveryData.deliveryChecksComplete}
            onChange={(e) => setDeliveryData(prev => ({ ...prev, deliveryChecksComplete: e.target.checked }))}
          />
        </div>
      
      <div className="newDeliveryFormFooter">
        <button type="button" className="cancel-btn" onClick={() => {
          setDeliveryData({
            deliveryDate: '',
            poNumber: '',
            supplier: '',
            selectedGoods: [],
            deliveryChecksComplete: false
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