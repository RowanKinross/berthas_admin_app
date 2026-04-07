import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, deleteDoc, doc} from '@firebase/firestore';
import { db } from '../firebase/firebase';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload } from '@fortawesome/free-solid-svg-icons';

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


function DeliveryHistory() {
  // Inline edit state for checked by
  const [editingCheckedBy, setEditingCheckedBy] = useState({});
  const [tempCheckedBy, setTempCheckedBy] = useState({});
  // Batches state
  const [batches, setBatches] = useState([]);

      // Save checked by to Firestore and update local state
      const handleCheckedBySave = async (deliveryId) => {
        if (!tempCheckedBy[deliveryId]) {
          setEditingCheckedBy((prev) => ({ ...prev, [deliveryId]: false }));
          return;
        }
        try {
          const deliveryRef = doc(db, 'deliveries', deliveryId);
          await import('firebase/firestore').then(({ updateDoc }) =>
            updateDoc(deliveryRef, { staffInitials: tempCheckedBy[deliveryId] })
          );
          setDeliveries((prev) => prev.map(d =>
            d.id === deliveryId ? { ...d, staffInitials: tempCheckedBy[deliveryId] } : d
          ));
        } catch (err) {
          alert('Error saving checked by: ' + err.message);
        }
        setEditingCheckedBy((prev) => ({ ...prev, [deliveryId]: false }));
      };
    // Inline edit state for batch: { [deliveryId_good]: true }
    const [editingBatch, setEditingBatch] = useState({});
    // Temp value state for batch: { [deliveryId_good]: batchString }
    const [tempBatch, setTempBatch] = useState({});

    // Save batch code to Firestore and update local state
    const handleBatchSave = async (deliveryId, good) => {
      const key = `${deliveryId}_${good}`;
      let newBatch = tempBatch[key] || '';
      if (newBatch.includes(':')) {
        newBatch = newBatch.replace(/:/g, ';');
      }
      try {
        const deliveryRef = doc(db, 'deliveries', deliveryId);
        const delivery = deliveries.find(d => d.id === deliveryId);
        if (!delivery) return;
        const updatedBatchCodes = { ...(delivery.batchCodes || {}), [good]: newBatch };
        await import('firebase/firestore').then(({ updateDoc }) =>
          updateDoc(deliveryRef, { batchCodes: updatedBatchCodes })
        );
        setDeliveries((prev) => prev.map(d =>
          d.id === deliveryId ? { ...d, batchCodes: updatedBatchCodes } : d
        ));
      } catch (err) {
        alert('Error saving batch code: ' + err.message);
      }
      setEditingBatch((prev) => ({ ...prev, [key]: false }));
    };
  const [deliveries, setDeliveries] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDelivery, setExpandedDelivery] = useState(null);
  // Inline edit state: { [deliveryId_good]: true }
  const [editingUseBy, setEditingUseBy] = useState({});
  // Temp value state: { [deliveryId_good]: dateString }
  const [tempUseBy, setTempUseBy] = useState({});
  // Inline edit state for allocation quantity: { [deliveryId_allocationIndex]: true }
  const [editingAllocationQty, setEditingAllocationQty] = useState({});
  // Temp value state for allocation quantity: { [deliveryId_allocationIndex]: quantityString }
  const [tempAllocationQty, setTempAllocationQty] = useState({});
  // Save use by date to Firestore and update local state
  const handleUseBySave = async (deliveryId, good) => {
    const key = `${deliveryId}_${good}`;
    const newDate = tempUseBy[key];
    if (!newDate) {
      setEditingUseBy((prev) => ({ ...prev, [key]: false }));
      return;
    }
    try {
      // Update Firestore
      const deliveryRef = doc(db, 'deliveries', deliveryId);
      // Find the delivery
      const delivery = deliveries.find(d => d.id === deliveryId);
      if (!delivery) return;
      const updatedUseByDates = { ...(delivery.useByDates || {}), [good]: newDate };
      await import('firebase/firestore').then(({ updateDoc }) =>
        updateDoc(deliveryRef, { useByDates: updatedUseByDates })
      );
      // Update local state
      setDeliveries((prev) => prev.map(d =>
        d.id === deliveryId ? { ...d, useByDates: updatedUseByDates } : d
      ));
    } catch (err) {
      alert('Error saving use by date: ' + err.message);
    }
    setEditingUseBy((prev) => ({ ...prev, [key]: false }));
  };

  const handleDeleteDelivery = async (deliveryId) => {
    const delivery = deliveries.find(d => d.id === deliveryId);
    if (!delivery) return;
    if (delivery.allocations && delivery.allocations.length > 0) {
      alert('Cannot delete this delivery because it has allocations.');
      return;
    }
    const supplier = delivery.supplier || 'Unknown Supplier';
    const dateStr = delivery.deliveryDate ? formatDate(new Date(delivery.deliveryDate)) : 'Unknown Date';
    const confirmed = window.confirm(`Are you sure you want to delete the delivery from ${supplier} on ${dateStr}? This action cannot be undone.`);
    if (!confirmed) return;
    try {
      await deleteDoc(doc(db, 'deliveries', deliveryId));
      setDeliveries(deliveries.filter(d => d.id !== deliveryId));
    } catch (err) {
      alert('Error deleting delivery: ' + err.message);
    }
  };

  const isManualAllocationBatch = (batchCode) => {
    const normalized = String(batchCode || '').trim().toLowerCase();
    return normalized === 'waste' || normalized === 'restaurant transfer' || normalized === 'waste/restaurant transfer';
  };

  const handleAllocationQuantitySave = async (deliveryId, allocationIndex) => {
    const key = `${deliveryId}_${allocationIndex}`;
    const newQuantityRaw = tempAllocationQty[key];
    const newQuantity = Number.parseFloat(newQuantityRaw);

    if (newQuantityRaw === undefined || newQuantityRaw === '' || Number.isNaN(newQuantity) || newQuantity < 0) {
      alert('Please enter a valid quantity.');
      return;
    }

    try {
      const deliveryRef = doc(db, 'deliveries', deliveryId);
      const delivery = deliveries.find(d => d.id === deliveryId);
      if (!delivery || !Array.isArray(delivery.allocations) || !delivery.allocations[allocationIndex]) return;

      const updatedAllocations = [...delivery.allocations];
      updatedAllocations[allocationIndex] = {
        ...updatedAllocations[allocationIndex],
        quantityAllocated: newQuantity
      };

      await import('firebase/firestore').then(({ updateDoc }) =>
        updateDoc(deliveryRef, { allocations: updatedAllocations })
      );

      setDeliveries((prev) => prev.map(d =>
        d.id === deliveryId ? { ...d, allocations: updatedAllocations } : d
      ));
    } catch (err) {
      alert('Error saving allocation quantity: ' + err.message);
    }

    setEditingAllocationQty((prev) => ({ ...prev, [key]: false }));
  };
  
  
  // Fetch deliveries from Firestore
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch deliveries
        const q = query(collection(db, 'deliveries'), orderBy('deliveryDate', 'desc'));
        const querySnapshot = await getDocs(q);
        const deliveriesData = querySnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data(),
          dateCreated: doc.data().dateCreated?.toDate() // Convert Firestore timestamp to Date
        }));
        setDeliveries(deliveriesData);

        // Fetch ingredients for icon display
        const ingredientsSnapshot = await getDocs(collection(db, 'ingredients'));
        const ingredientsData = ingredientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setIngredients(ingredientsData);

        // Fetch batches for allocation pizza lookup
        const batchesSnapshot = await getDocs(collection(db, 'batches'));
        const batchesData = batchesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setBatches(batchesData);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getIngredientData = (ingredientName) => {
    return ingredients.find(ingredient => ingredient.name === ingredientName);
  };

  const toggleExpanded = (deliveryId) => {
    setExpandedDelivery(expandedDelivery === deliveryId ? null : deliveryId);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatDateForCSV = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  };

  const csvEscape = (value) => {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const formatQuantityForCSV = (value) => {
    const parsed = Number.parseFloat(value);
    if (Number.isNaN(parsed)) return '';
    return parsed.toFixed(2).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
  };

  const generateDeliveryCSV = () => {
    const rows = deliveries.map((delivery) => {
      const allocations = Array.isArray(delivery.allocations) ? delivery.allocations : [];
      const selectedGoods = Array.isArray(delivery.selectedGoods) ? delivery.selectedGoods : [];

      const ingredientRows = selectedGoods.map((good) => {
        const ingredientBatchCode = delivery.batchCodes?.[good] || '';
        const allocationsForGood = allocations.filter((allocation) => allocation.ingredientName === good);
        const qtyDelivered = formatQuantityForCSV(delivery.quantities?.[good] ?? '');
        const qtyAllocated = formatQuantityForCSV(
          allocationsForGood.reduce((sum, allocation) => {
            const parsed = Number.parseFloat(allocation.quantityAllocated);
            return sum + (Number.isNaN(parsed) ? 0 : parsed);
          }, 0)
        );
        const allocationSummary = allocationsForGood
          .map((allocation) => {
            const batchCode = allocation.allocatedToBatchCode || '';
            const quantity = formatQuantityForCSV(allocation.quantityAllocated);
            return `${batchCode}:${quantity}`;
          })
          .filter((entry) => !entry.endsWith(':'))
          .join(', ');

        const goodLabel = `${String(good).toUpperCase()}(${ingredientBatchCode})`;
        return {
          goodsDelivered: allocationSummary ? `${goodLabel} - ${allocationSummary}` : goodLabel,
          qtyDelivered,
          qtyAllocated
        };
      });

      return {
        deliveryId: delivery.id || '',
        supplier: delivery.supplier || '',
        deliveryDate: formatDateForCSV(delivery.deliveryDate),
        poNumber: delivery.poNumber || '',
        checkedBy: delivery.staffInitials || '',
        qualityChecked: delivery.deliveryChecksComplete ? 'Yes' : 'No',
        goodsDeliveredEntries: ingredientRows.map((row) => row.goodsDelivered),
        qtyDeliveredEntries: ingredientRows.map((row) => row.qtyDelivered),
        qtyAllocatedEntries: ingredientRows.map((row) => row.qtyAllocated)
      };
    });

    const maxGoodsColumns = rows.reduce(
      (max, row) => Math.max(max, row.goodsDeliveredEntries.length),
      0
    );

    const goodsHeaders = Array.from({ length: maxGoodsColumns }, (_, index) => `goodsDelivered_${index}`);
    const qtyDeliveredHeaders = Array.from({ length: maxGoodsColumns }, (_, index) => `qtyDelivered_${index}`);
    const qtyAllocatedHeaders = Array.from({ length: maxGoodsColumns }, (_, index) => `qtyAllocated_${index}`);

    const ingredientTripletHeaders = Array.from({ length: maxGoodsColumns }, (_, index) => [
      goodsHeaders[index],
      qtyDeliveredHeaders[index],
      qtyAllocatedHeaders[index]
    ]).flat();

    const headers = [
      'deliveryId',
      'supplier',
      'deliveryDate',
      'poNumber',
      'checkedBy',
      'qualityChecked',
      ...ingredientTripletHeaders
    ];

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => {
        const csvRow = {
          deliveryId: row.deliveryId,
          supplier: row.supplier,
          deliveryDate: row.deliveryDate,
          poNumber: row.poNumber,
          checkedBy: row.checkedBy,
          qualityChecked: row.qualityChecked
        };

        goodsHeaders.forEach((header, index) => {
          csvRow[header] = row.goodsDeliveredEntries[index] || '';
        });

        qtyDeliveredHeaders.forEach((header, index) => {
          csvRow[header] = row.qtyDeliveredEntries[index] || '';
        });

        qtyAllocatedHeaders.forEach((header, index) => {
          csvRow[header] = row.qtyAllocatedEntries[index] || '';
        });

        return headers.map((header) => csvEscape(csvRow[header])).join(',');
      })
    ].join('\n');

    const dateStamp = new Date().toISOString().slice(0, 10);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `deliveries_allocations_${dateStamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="loading">Loading delivery history...</div>;
  }

  if (deliveries.length === 0) {
    return (
      <div className="delivery-history">
        <h3>Delivery History</h3>
        <div className="no-deliveries">
          <p>No deliveries recorded yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="delivery-history">
      <div className='deliveryHistoryContainer'>
        <h3 className='deliveryHistoryTitle'>Delivery History </h3>
        <div 
          className="downloadCSVButton"
          onClick={generateDeliveryCSV}
          title="Download delivery CSV"
        >
          <FontAwesomeIcon icon={faDownload} aria-hidden="true" />
        </div>
      </div>
      <div className="deliveries-list">
        {deliveries.map(delivery => (
          <div key={delivery.id} className="delivery-card">
            <div 
              className="delivery-header" 
              onClick={() => toggleExpanded(delivery.id)
              }
            >
              <div className="delivery-summary">
                <h4>{delivery.supplier || 'Unknown Supplier'}</h4>
                <div className="delivery-meta">
                  <span className="delivery-date">{formatDate(new Date(delivery.deliveryDate))}</span>
                  <span className="po-number">PO: {delivery.poNumber || 'N/A'}</span>
                  <span className="goods-count">
                    {delivery.selectedGoods?.length || 0} item{delivery.selectedGoods?.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              <div className={`expand-icon ${expandedDelivery === delivery.id ? 'expanded' : ''}`}>
                ▼
              </div>
            </div>
            
            {expandedDelivery === delivery.id && (
              <div className="delivery-details">

                
                {delivery.selectedGoods && delivery.selectedGoods.length > 0 && (
                  <div className="goods-details">
                    <div >
                      {delivery.selectedGoods.map(good => {
                        const ingredientData = getIngredientData(good);
                        return (
                        <div key={good} className="good-item">
                          <div className="good-name" style={{ display: 'flex', alignItems: 'center' }}>
                            {ingredientData?.packaging && (
                              <PackagingIcon 
                                packaging={ingredientData.packaging} 
                                ingredientName={good} 
                                size="small" 
                              />
                            )}
                            {good}:
                          </div>
                          <div className="good-details">
                            {delivery.quantities && delivery.quantities[good] && (
                              <div className="detail-item">
                                <span className="detail-label">Qty:</span>
                                <span className="detail-value">{delivery.quantities[good]}</span>
                              </div>
                            )}
                            {delivery.batchCodes && (
                              <div className="detail-item">
                                <span className="detail-label">Batch:</span>
                                {(() => {
                                  const key = `${delivery.id}_${good}`;
                                  if (editingBatch[key]) {
                                    return (
                                      <input
                                        type="text"
                                        className="inline-batch-input"
                                        value={
                                          tempBatch[key] !== undefined
                                            ? tempBatch[key]
                                            : (delivery.batchCodes[good] || '')
                                        }
                                        onChange={e => {
                                          setTempBatch(prev => ({ ...prev, [key]: e.target.value }));
                                        }}
                                        onBlur={() => handleBatchSave(delivery.id, good)}
                                        autoFocus
                                        style={{ marginLeft: 8, width: 90 }}
                                      />
                                    );
                                  } else {
                                    return (
                                      <span
                                        className="detail-value"
                                        style={{ marginLeft: 8, cursor: 'pointer', borderBottom: '1px dashed #888' }}
                                        title="Click to edit"
                                        onClick={() => {
                                          setEditingBatch(prev => ({ ...prev, [key]: true }));
                                          setTempBatch(prev => ({
                                            ...prev,
                                            [key]: delivery.batchCodes[good] || ''
                                          }));
                                        }}
                                      >
                                        {delivery.batchCodes[good] || <span style={{ color: '#aaa' }}>Set batch</span>}
                                      </span>
                                    );
                                  }
                                })()}
                              </div>
                            )}
                            {delivery.temperatures && delivery.temperatures[good] && (
                              <div className="detail-item">
                                <span className="detail-label">Temp:</span>
                                <span className="detail-value">{delivery.temperatures[good]}</span>
                              </div>
                            )}
                            {delivery.useByDates && (
                              <div className="detail-item">
                                <span className="detail-label">Use by:</span>
                                {(() => {
                                  const key = `${delivery.id}_${good}`;
                                  if (editingUseBy[key]) {
                                    return (
                                      <input
                                        type="date"
                                        className="inline-useby-input"
                                        value={
                                          tempUseBy[key] ||
                                          (delivery.useByDates[good]
                                            ? new Date(delivery.useByDates[good]).toISOString().slice(0, 10)
                                            : '')
                                        }
                                        onChange={e => {
                                          setTempUseBy(prev => ({ ...prev, [key]: e.target.value }));
                                        }}
                                        onBlur={() => handleUseBySave(delivery.id, good)}
                                        autoFocus
                                        style={{ marginLeft: 8 }}
                                      />
                                    );
                                  } else {
                                    return (
                                      <span
                                        className="detail-value"
                                        style={{ marginLeft: 8, cursor: 'pointer', borderBottom: '1px dashed #888' }}
                                        title="Click to edit"
                                        onClick={() => {
                                          const key = `${delivery.id}_${good}`;
                                          setEditingUseBy(prev => ({ ...prev, [key]: true }));
                                          setTempUseBy(prev => ({
                                            ...prev,
                                            [key]: delivery.useByDates[good]
                                              ? new Date(delivery.useByDates[good]).toISOString().slice(0, 10)
                                              : ''
                                          }));
                                        }}
                                      >
                                        {delivery.useByDates[good]
                                          ? formatDate(new Date(delivery.useByDates[good]))
                                          : <span style={{ color: '#aaa' }}>Set date</span>}
                                      </span>
                                    );
                                  }
                                })()}
                              </div>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Allocations section */}
                {delivery.allocations && delivery.allocations.length > 0 && (
                  <div className="allocationsSection">
                    <h5 className="stockAllocationsTitle"style={{ }}><strong>→</strong> Allocations:</h5>
                    <div className="allocations-details">
                      {delivery.selectedGoods?.map(good => {
                        const allocations = delivery.allocations.filter(alloc => alloc.ingredientName === good);
                        if (allocations.length === 0) return null;
                        
                        const totalAllocated = allocations.reduce((sum, alloc) => sum + (alloc.quantityAllocated || 0), 0);
                        const deliveredQty = delivery.quantities && delivery.quantities[good] 
                          ? parseInt(delivery.quantities[good]) || 0 
                          : 0;
                        const remainingQty = deliveredQty - totalAllocated;
                        
                        return (
                          <div key={`${good}-allocations`} className="ingredient-allocations">
                            <div className="allocation-header" style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              marginBottom: '8px',
                              fontSize: '0.9em',
                              fontWeight: 'bold'
                            }}>
                              {good}
                              <span style={{ 
                                marginLeft: '10px', 
                                fontSize: '0.8em', 
                                color: '#666',
                                fontWeight: 'normal' 
                              }}>
                                ({totalAllocated.toFixed(2)} of {deliveredQty} allocated, {remainingQty.toFixed(2)} remaining)
                              </span>
                            </div>
                            <div className="allocations-list" style={{ marginLeft: '30px' }}>
                              {allocations.map((alloc, index) => {
                                const allocationIndex = (delivery.allocations || []).findIndex(a => a === alloc);
                                const allocationKey = `${delivery.id}_${allocationIndex}`;
                                const canEditQuantity = allocationIndex !== -1 && isManualAllocationBatch(alloc.allocatedToBatchCode);
                                let pizzaList = null;
                                if (alloc.batchType === 'pizzas' && alloc.allocatedToBatchId && batches.length > 0) {
                                  const batch = batches.find(b => b.id === alloc.allocatedToBatchId);
                                  if (batch && Array.isArray(batch.pizzas)) {
                                    // Find pizzas in this batch that use this ingredient
                                    const pizzasWithIngredient = batch.pizzas.filter(pizza => Array.isArray(pizza.ingredients) && pizza.ingredients.includes(alloc.ingredientName));
                                    if (pizzasWithIngredient.length > 0) {
                                      pizzaList = (
                                        <div>
                                          {pizzasWithIngredient.map(p => p.pizza_title || p.id).join(', ').toLowerCase()}
                                        </div>
                                      );
                                    }
                                  }
                                }
                                // For starter allocations, show all pizzas in batches using this starter batch code
                                if (alloc.batchType === 'starter' && alloc.allocatedToBatchCode && batches.length > 0) {
                                  const batchesWithStarter = batches.filter(b => b.starter_batch_code === alloc.allocatedToBatchCode);
                                  if (batchesWithStarter.length > 0) {
                                    pizzaList = (
                                      <div>
                                        {batchesWithStarter.map(b => b.batch_code || b.id).join(', ')}
                                      </div>
                                    );
                                  }
                                }
                                return (
                                  <div key={index} className="allocation-item" style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    padding: '4px 0',
                                    borderBottom: '1px solid #f0f0f0',
                                    fontSize: '0.8em'
                                  }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <div className="allocationBatch">
                                        •  Batch: <strong>{alloc.allocatedToBatchCode} </strong>
                                        {alloc.batchType === 'starter'
                                          ? `- Starter ➔ Batches: `
                                          : alloc.batchType === 'dough balls'
                                            ? `- Dough Balls`
                                            : ''}
                                        {pizzaList && <>- {pizzaList}</>}
                                      </div>
                                      <div className="allocation-quantity" style={{ fontWeight: 'bold' }}>
                                        {canEditQuantity && editingAllocationQty[allocationKey] ? (
                                          <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={
                                              tempAllocationQty[allocationKey] !== undefined
                                                ? tempAllocationQty[allocationKey]
                                                : String(alloc.quantityAllocated ?? '')
                                            }
                                            onChange={e => {
                                              setTempAllocationQty(prev => ({ ...prev, [allocationKey]: e.target.value }));
                                            }}
                                            onBlur={() => handleAllocationQuantitySave(delivery.id, allocationIndex)}
                                            onKeyDown={e => {
                                              if (e.key === 'Enter') {
                                                e.currentTarget.blur();
                                              }
                                            }}
                                            autoFocus
                                            style={{ width: 70 }}
                                          />
                                        ) : (
                                          <span
                                            style={canEditQuantity ? { cursor: 'pointer', borderBottom: '1px dashed #888' } : undefined}
                                            title={canEditQuantity ? 'Click to edit quantity' : undefined}
                                            onClick={() => {
                                              if (!canEditQuantity) return;
                                              setEditingAllocationQty(prev => ({ ...prev, [allocationKey]: true }));
                                              setTempAllocationQty(prev => ({
                                                ...prev,
                                                [allocationKey]: String(alloc.quantityAllocated ?? '')
                                              }));
                                            }}
                                          >
                                            {(alloc.quantityAllocated || 0).toFixed(2)}
                                          </span>
                                        )}{' '}
                                        {getIngredientData(good)?.packaging || 'units'}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                <div className="delivery-info">
                  <div className="info-row">
                    <strong>Quality Checked:</strong> 
                    <span className={`status ${delivery.deliveryChecksComplete ? 'completed' : 'pending'}`}>
                      {delivery.deliveryChecksComplete ? ' ✓' : ' ✗'}
                    </span>
                    <ul className='qualityChecks'>
                      <li>packed to protect the product (no loose deliveries of product are permitted)</li>
                      <li>free from any pest infestation</li>
                      <li>within shelf life (use by date & best before date)</li>
                      <li>in good condition - no visible sign of damage etc</li>
                      <li>allergenic ingredients free from damage and sufficiently packaged to prevent contamination</li>
                  </ul>
                  </div>
                </div>
                <div className="delivery-info">
                  <div className="info-row">
                    <strong>Checked by:</strong>
                    {editingCheckedBy[delivery.id] ? (
                      <input
                        type="text"
                        className="inline-checkedby-input"
                        value={
                          tempCheckedBy[delivery.id] !== undefined
                            ? tempCheckedBy[delivery.id]
                            : (delivery.staffInitials || '')
                        }
                        onChange={e => {
                          setTempCheckedBy(prev => ({ ...prev, [delivery.id]: e.target.value }));
                        }}
                        onBlur={() => handleCheckedBySave(delivery.id)}
                        autoFocus
                        style={{ marginLeft: 8, width: 60 }}
                      />
                    ) : (
                      <span
                        className="staffInitials"
                        style={{ marginLeft: 8, cursor: 'pointer', borderBottom: '1px dashed #888' }}
                        title="Click to edit"
                        onClick={() => {
                          setEditingCheckedBy(prev => ({ ...prev, [delivery.id]: true }));
                          setTempCheckedBy(prev => ({
                            ...prev,
                            [delivery.id]: delivery.staffInitials || ''
                          }));
                        }}
                      >
                        {delivery.staffInitials || <span style={{ color: '#aaa' }}>Set initials</span>}
                      </span>
                    )}
                  </div>
                </div>
                <div className="delivery-info deleteDeliverySection">
                  <div className="button deleteDelivery"
                   onClick={() => handleDeleteDelivery(delivery.id)}>
                    Delete Delivery
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default DeliveryHistory;