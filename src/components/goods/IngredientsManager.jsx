import React, { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, addDoc } from '@firebase/firestore';
import { db } from '../firebase/firebase';
import {faSort, faPlus} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

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

function IngredientsManager() {
  const [ingredientsArr, setIngredientsArr] = useState([]);
  const [editingField, setEditingField] = useState({ id: null, field: null });
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [existingSuppliers, setExistingSuppliers] = useState([]);
  const [sortBy, setSortBy] = useState('name'); // 'name' or 'supplier'
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newIngredientForm, setNewIngredientForm] = useState({
    name: '',
    packaging: 'box',
    supplier: '',
    perPizzaQuantity: '0',
    unitQuantity: '0',
    preOrderAmount: '0'
  });

  // Fetch ingredients from Firestore
  useEffect(() => {
    const fetchIngredients = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'ingredients'));
        const ingredientsData = querySnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));
        setIngredientsArr(ingredientsData);
      } catch (error) {
        console.error("Error fetching ingredients:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchIngredients();
  }, []);

  // Extract unique suppliers from ingredients data
  useEffect(() => {
    const suppliers = [...new Set(
      ingredientsArr
        .map(ingredient => ingredient.supplier)
        .filter(supplier => supplier && supplier.trim() !== '')
    )].sort();
    setExistingSuppliers(suppliers);
  }, [ingredientsArr]);

  // Handle keyboard shortcuts for modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showModal) {
        closeModal();
      }
    };

    if (showModal) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showModal]);

  const handleEditChange = (e) => {
    setEditValue(e.target.value);
  };

  const handleBlur = async (ingredient) => {
    if (editValue.trim() === '') {
      setEditingField({ id: null, field: null });
      setEditValue('');
      return;
    }

    try {
      const ingredientRef = doc(db, 'ingredients', ingredient.id);
      let updateData = {};

      switch (editingField.field) {
        case 'packaging':
          updateData.packaging = editValue;
          break;
        case 'supplier':
          updateData.supplier = editValue;
          break;
        case 'ratio':
          // For ratio, we're editing just the pizza quantity part
          const [, qtyPerUnit] = ingredient.ratio.split(':');
          updateData.ratio = `${editValue}:${qtyPerUnit}`;
          break;
        case 'unitQuantity':
          // For unit quantity, we're editing the second part of the ratio
          const [qtyPerPizza] = ingredient.ratio.split(':');
          updateData.ratio = `${qtyPerPizza}:${editValue}`;
          break;
        case 'preOrderAmount':
          updateData.preOrderAmount = parseFloat(editValue) || 0;
          break;
        default:
          break;
      }

      await updateDoc(ingredientRef, updateData);
      
      // Update local state
      setIngredientsArr(prev => 
        prev.map(ing => 
          ing.id === ingredient.id 
            ? { ...ing, ...updateData }
            : ing
        )
      );

      console.log('Ingredient updated successfully');
    } catch (error) {
      console.error('Error updating ingredient:', error);
      alert('Error updating ingredient');
    }

    setEditingField({ id: null, field: null });
    setEditValue('');
  };

  // Modal functions
  const openAddModal = () => {
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setNewIngredientForm({
      name: '',
      packaging: 'box',
      supplier: '',
      perPizzaQuantity: '0',
      unitQuantity: '0',
      preOrderAmount: '0'
    });
  };

  const handleFormChange = (field, value) => {
    setNewIngredientForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    
    if (!newIngredientForm.name.trim()) {
      alert('Please enter an ingredient name');
      return;
    }

    try {
      const newIngredient = {
        name: newIngredientForm.name.trim(),
        packaging: newIngredientForm.packaging,
        supplier: newIngredientForm.supplier.trim(),
        ratio: `${newIngredientForm.perPizzaQuantity}:${newIngredientForm.unitQuantity}`,
        preOrderAmount: parseFloat(newIngredientForm.preOrderAmount) || 0
      };

      const docRef = await addDoc(collection(db, 'ingredients'), newIngredient);
      
      // Add to local state with the generated ID
      const ingredientWithId = {
        id: docRef.id,
        ...newIngredient
      };
      
      setIngredientsArr(prev => [...prev, ingredientWithId]);
      closeModal();
      
      console.log('New ingredient added successfully');
    } catch (error) {
      console.error('Error adding new ingredient:', error);
      alert('Error adding new ingredient');
    }
  };

  // Sort ingredients based on current sort preference
  const sortedIngredients = [...ingredientsArr].sort((a, b) => {
    if (sortBy === 'supplier') {
      const supplierA = (a.supplier || '').toLowerCase();
      const supplierB = (b.supplier || '').toLowerCase();
      // Put items without suppliers at the end
      if (!supplierA && supplierB) return 1;
      if (supplierA && !supplierB) return -1;
      return supplierA.localeCompare(supplierB);
    } else {
      // Sort by name (default)
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    }
  });

  const handleKeyPress = (e, ingredient) => {
    if (e.key === 'Enter') {
      handleBlur(ingredient);
    }
    if (e.key === 'Escape') {
      setEditingField({ id: null, field: null });
      setEditValue('');
    }
  };

  if (loading) {
    return <div className="loading">Loading ingredients...</div>;
  }

  return (
    <div className="ingredients-manager">
      <div className='editIngredients'>
        
        
        <div className='ingredientSupplierHeader'>
          <p className='nameUnit nameUnitIngredient'>
            <strong>Ingredient Name: </strong> 
            <div 
              className={`${sortBy === 'name' ? 'active' : ''}`}
              onClick={() => setSortBy('name')}
            >
            <FontAwesomeIcon icon={faSort}/> 
            </div>
          </p>
          <p className='nameUnit nameUnitSupplier'>
            <strong>Supplier: </strong>
            <div 
            className={`${sortBy === 'supplier' ? 'active' : ''}`}
            onClick={() => setSortBy('supplier')}>
            <FontAwesomeIcon icon={faSort}/> 
            </div>
          </p>
          {/* <p className='nameUnit nameUnitPerPizza'><strong>Per pizza:</strong></p>
          <p className='nameUnit nameUnitPreOrder'><strong>Prep/Order amount:</strong></p> */}
        </div>

      
        
        {ingredientsArr.length > 0 ? (
          <div>
            {sortedIngredients.map((ingredient, index) => {
              const [qtyPerPizza, qtyPerUnit] = ingredient.ratio ? ingredient.ratio.split(':') : ['0', '0'];
              const isSimpleUnit = ingredient.packaging === 'kg' || ingredient.packaging === 'g';

              return (
                <div className='ingredientManageContainer' key={ingredient.id}>
                  <div className='ingredientRow'>
                    {/* Name field */}
                    <div className='nameUnit nameUnitIngredient'>
                      <p style={{ cursor: 'default', margin: 0 }}>
                        <PackagingIcon 
                          packaging={ingredient.packaging || 'box'} 
                          ingredientName={ingredient.name || ''} 
                          size="normal" 
                        />
                        <strong className="iconName">{ingredient.name} </strong>
                      </p>
                      
                      {/* Packaging */}
                      {!isSimpleUnit && (
                        <div className='unitBlock nameUnit nameUnitPackaging'>
                          {/* Edit unit quantity (second part of ratio) */}
                          {editingField.id === ingredient.id && editingField.field === 'unitQuantity' ? (
                            <input
                              className='inputBox'
                              type="text"
                              value={editValue}
                              onChange={handleEditChange}
                              onBlur={() => handleBlur(ingredient)}
                              onKeyDown={(e) => handleKeyPress(e, ingredient)}
                              autoFocus
                            />
                          ) : (
                            <p
                              onClick={() => {
                                setEditingField({ id: ingredient.id, field: 'unitQuantity' });
                                setEditValue(qtyPerUnit);
                              }}
                            >
                              {qtyPerUnit}
                            </p>
                          )}

                          {/* Fixed kg label */}
                          <p>kg</p>

                          {/* Edit packaging */}
                          {editingField.id === ingredient.id && editingField.field === 'packaging' ? (
                            <input
                              className='inputBox'
                              type="text"
                              value={editValue}
                              onChange={handleEditChange}
                              onBlur={() => handleBlur(ingredient)}
                              onKeyDown={(e) => handleKeyPress(e, ingredient)}
                              autoFocus
                            />
                          ) : (
                            <p
                              onClick={() => {
                                setEditingField({ id: ingredient.id, field: 'packaging' });
                                setEditValue(ingredient.packaging);
                              }}
                              className='unitSpacing'
                            >
                              {ingredient.packaging}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className='nameUnit nameUnitSupplier'>
                      {/* Supplier */}
                      {editingField.id === ingredient.id && editingField.field === 'supplier' ? (
                        <>
                          <input
                            className='dropdownInput'
                            type="text"
                            value={editValue}
                            onChange={handleEditChange}
                            onBlur={() => handleBlur(ingredient)}
                            onKeyDown={(e) => handleKeyPress(e, ingredient)}
                            placeholder="Enter supplier name"
                            list={`suppliers-${ingredient.id}`}
                            autoFocus
                          />
                          <datalist id={`suppliers-${ingredient.id}`}>
                            {existingSuppliers.map((supplier, index) => (
                              <option key={index} value={supplier} />
                            ))}
                          </datalist>
                        </>
                      ) : (
                        <strong onClick={() => {
                          setEditingField({ id: ingredient.id, field: 'supplier' });
                          setEditValue(ingredient.supplier || '');
                        }}>
                          {ingredient.supplier || 'Click to add supplier'}
                        </strong>
                      )}
                    </div>
                  </div>

                  <div className='perPizzaContainer'>
                    <div className='nameUnit nameUnitPerPizza'>
                      {/* Quantity per pizza */}
                      <p className='perPizzaHeader'>Per Pizza: </p>
                      {editingField.id === ingredient.id && editingField.field === 'ratio' ? (
                        <input
                          className='inputBox'
                          type="text"
                          value={editValue}
                          onChange={handleEditChange}
                          onBlur={() => handleBlur(ingredient)}
                          onKeyDown={(e) => handleKeyPress(e, ingredient)}
                          autoFocus
                        />
                      ) : (
                        <p onClick={() => {
                          setEditingField({ id: ingredient.id, field: 'ratio' });
                          setEditValue(qtyPerPizza);
                        }}>
                          {qtyPerPizza}
                        </p>
                      )}
                      <p>g</p>
                    </div>

                    <div className='nameUnit nameUnitPreOrder'>
                      {/* Pre/order amount */}
                        <p className='perPizzaHeader'>Prep/Order Amount: </p>
                      {editingField.id === ingredient.id && editingField.field === 'preOrderAmount' ? (
                        <input
                          className='inputBox'
                          type="text"
                          value={editValue}
                          onChange={handleEditChange}
                          onBlur={() => handleBlur(ingredient)}
                          onKeyDown={(e) => handleKeyPress(e, ingredient)}
                          placeholder="0"
                          autoFocus
                        />
                      ) : (
                        <p onClick={() => {
                          setEditingField({ id: ingredient.id, field: 'preOrderAmount' });
                          setEditValue(ingredient.preOrderAmount?.toString() || '0');
                        }}>
                          {ingredient.preOrderAmount || '0'}g
                        </p>
                      )}
                    </div>
                  </div>

                </div>
              );
            })}

          <div className="addIngredientSection">
          <button 
            className="button addIngredientButton"
            onClick={openAddModal}
          >
            <FontAwesomeIcon icon={faPlus} />
            <div className='addIngredient'>Add New Ingredient</div>
          </button>
        </div>
          </div>
        ) : (
          <div className="no-ingredients">
            <p>No ingredients found.</p>
          </div>
        )}
      </div>

      {/* Add Ingredient Modal */}
      {showModal && (
        <div 
          className="modal-overlay" 
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div 
            className="modal-content"
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Add New Ingredient</h3>
            
            <form onSubmit={handleFormSubmit}>
              {/* Ingredient Name */}
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Ingredient Name *
                </label>
                <input
                  type="text"
                  value={newIngredientForm.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  placeholder="Enter ingredient name"
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Packaging */}
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Packaging
                </label>
                <select
                  value={newIngredientForm.packaging}
                  onChange={(e) => handleFormChange('packaging', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                >
                  <option value="box">Box</option>
                  <option value="bag">Bag</option>
                  <option value="tin">Tin/Can</option>
                  <option value="bottle">Bottle</option>
                  <option value="jar">Jar</option>
                  <option value="bucket">Bucket</option>
                  <option value="tray">Tray</option>
                  <option value="sack">Sack</option>
                  <option value="kg">Kg</option>
                </select>
              </div>

              {/* Supplier */}
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Supplier
                </label>
                <input
                  type="text"
                  value={newIngredientForm.supplier}
                  onChange={(e) => handleFormChange('supplier', e.target.value)}
                  placeholder="Enter supplier name"
                  list="suppliers-modal"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
                <datalist id="suppliers-modal">
                  {existingSuppliers.map((supplier, index) => (
                    <option key={index} value={supplier} />
                  ))}
                </datalist>
              </div>

              {/* Quantity per Pizza */}
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Quantity per Pizza (grams)
                </label>
                <input
                  type="number"
                  value={newIngredientForm.perPizzaQuantity}
                  onChange={(e) => handleFormChange('perPizzaQuantity', e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.1"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Unit Quantity */}
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Unit Quantity (kg per package)
                </label>
                <input
                  type="number"
                  value={newIngredientForm.unitQuantity}
                  onChange={(e) => handleFormChange('unitQuantity', e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.1"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Prep/Order Amount */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Prep/Order Amount (grams)
                </label>
                <input
                  type="number"
                  value={newIngredientForm.preOrderAmount}
                  onChange={(e) => handleFormChange('preOrderAmount', e.target.value)}
                  placeholder="0"
                  min="0"
                  step="1"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Form Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={closeModal}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Add Ingredient
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default IngredientsManager;