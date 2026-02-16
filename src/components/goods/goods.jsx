// import berthasLogo from './bertha_logo'
import './goods.css';
import React, {useState, useEffect} from 'react';
import { app, db } from '../firebase/firebase';
import { collection, addDoc, getDocs, getDoc, doc, updateDoc } from '@firebase/firestore';

function Goods() {
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [ingredients, setIngredients] = useState([]);
  const [deliveryData, setDeliveryData] = useState({
    supplier: '',
    deliveryDate: '',
    selectedGoods: [],
    deliveryChecksComplete: false,
    goodsTemperature: ''
  });
  const [batchCodes, setBatchCodes] = useState({});

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

  const handleAddDelivery = () => {
    setShowDeliveryForm(true);
    setDeliveryData({
      supplier: '',
      deliveryDate: '',
      selectedGoods: [],
      deliveryChecksComplete: false,
      goodsTemperature: ''
    });
    setBatchCodes({});
  };

  const handleGoodsChange = (e) => {
    const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
    setDeliveryData(prev => ({
      ...prev,
      selectedGoods: selectedOptions
    }));

    // Initialize batch codes for newly selected goods
    const newBatchCodes = { ...batchCodes };
    selectedOptions.forEach(good => {
      if (!newBatchCodes[good]) {
        newBatchCodes[good] = '';
      }
    });
    // Remove batch codes for unselected goods
    Object.keys(newBatchCodes).forEach(good => {
      if (!selectedOptions.includes(good)) {
        delete newBatchCodes[good];
      }
    });
    setBatchCodes(newBatchCodes);
  };

  const handleBatchCodeChange = (ingredient, value) => {
    setBatchCodes(prev => ({
      ...prev,
      [ingredient]: value
    }));
  };

  const handleSaveDelivery = async () => {
    try {
      const deliveryRecord = {
        ...deliveryData,
        batchCodes,
        dateCreated: new Date()
      };
      
      await addDoc(collection(db, 'deliveries'), deliveryRecord);
      setShowDeliveryForm(false);
      alert('Delivery record saved successfully!');
    } catch (error) {
      console.error("Error saving delivery record:", error);
      alert('Error saving delivery record');
    }
  };

  return (
    <div className='goods navContent'>
        <h2>GOODS IN</h2>
      
      
      <div className="goods-header">
        <button className="add-delivery-btn" onClick={handleAddDelivery}>
          + Add Delivery
        </button>
      </div>

      {/* Custom Delivery Form Modal */}
      {showDeliveryForm && (
        <div className="modal" onClick={() => setShowDeliveryForm(false)}>
          <div className="modalContent" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>New Delivery Form</h3>
              <button className="close-btn" onClick={() => setShowDeliveryForm(false)}>
                ×
              </button>
            </div>
            
            <form>
              {/* Supplier */}
              <div className="form-group">
                <label>Supplier:</label>
                <input
                  type="text"
                  value={deliveryData.supplier}
                  onChange={(e) => setDeliveryData(prev => ({ ...prev, supplier: e.target.value }))}
                  placeholder="Enter supplier name"
                />
              </div>

              {/* Delivery Date */}
              <div className="form-group">
                <label>Delivery Date:</label>
                <input
                  type="date"
                  value={deliveryData.deliveryDate}
                  onChange={(e) => setDeliveryData(prev => ({ ...prev, deliveryDate: e.target.value }))}
                />
              </div>

              {/* Goods Selection */}
              <div className="form-group">
                <label>Goods:</label>
                <select
                  multiple
                  value={deliveryData.selectedGoods}
                  onChange={handleGoodsChange}
                  className="goods-select"
                >
                  {ingredients.map(ingredient => (
                    <option key={ingredient.id} value={ingredient.name}>
                      {ingredient.name}
                    </option>
                  ))}
                </select>
                <small className="help-text">
                  Hold Ctrl (or Cmd on Mac) to select multiple items
                </small>
              </div>

              {/* Batch Codes for Selected Goods */}
              {deliveryData.selectedGoods.length > 0 && (
                <div className="form-group">
                  <h4>Batch Codes:</h4>
                  {deliveryData.selectedGoods.map(good => (
                    <div key={good} className="batch-code-row">
                      <label className="batch-label">{good}:</label>
                      <input
                        type="text"
                        value={batchCodes[good] || ''}
                        onChange={(e) => handleBatchCodeChange(good, e.target.value)}
                        placeholder="Enter batch code"
                        className="batch-input"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Delivery Checks Complete */}
              <div className="form-group checkbox-group">
                <input
                  type="checkbox"
                  id="delivery-checks"
                  checked={deliveryData.deliveryChecksComplete}
                  onChange={(e) => setDeliveryData(prev => ({ ...prev, deliveryChecksComplete: e.target.checked }))}
                />
                <label htmlFor="delivery-checks">Delivery checks complete?</label>
              </div>

              {/* Goods Temperature */}
              <div className="form-group">
                <label>Goods Temperature:</label>
                <input
                  type="text"
                  value={deliveryData.goodsTemperature}
                  onChange={(e) => setDeliveryData(prev => ({ ...prev, goodsTemperature: e.target.value }))}
                  placeholder="Enter temperature (e.g., 4°C)"
                />
              </div>
            </form>
            
            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setShowDeliveryForm(false)}>
                Cancel
              </button>
              <button className="save-btn" onClick={handleSaveDelivery}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Goods;