import React, { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc } from '@firebase/firestore';
import { db } from '../firebase/firebase';
import {faSort} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

function IngredientsManager() {
  const [ingredientsArr, setIngredientsArr] = useState([]);
  const [editingField, setEditingField] = useState({ id: null, field: null });
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [existingSuppliers, setExistingSuppliers] = useState([]);
  const [sortBy, setSortBy] = useState('name'); // 'name' or 'supplier'

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
        case 'name':
          updateData.name = editValue;
          break;
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
            <strong>Ingredient:</strong> 
            <div 
              className={`${sortBy === 'name' ? 'active' : ''}`}
              onClick={() => setSortBy('name')}
            >
            <FontAwesomeIcon icon={faSort}/> 
            </div>
          </p>
          <p className='nameUnit nameUnitSupplier'>
            <strong>Supplier:</strong>
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
                      {editingField.id === ingredient.id && editingField.field === 'name' ? (
                        <input
                          className='inputField'
                          type="text"
                          value={editValue}
                          onChange={handleEditChange}
                          onBlur={() => handleBlur(ingredient)}
                          onKeyDown={(e) => handleKeyPress(e, ingredient)}
                          autoFocus
                        />
                      ) : (
                        <p onClick={() => {
                          setEditingField({ id: ingredient.id, field: 'name' });
                          setEditValue(ingredient.name);
                        }}>
                          <strong className='p-2'>{ingredient.name} </strong>
                        </p>
                      )}
                      
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
          </div>
        ) : (
          <div className="no-ingredients">
            <p>No ingredients found.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default IngredientsManager;