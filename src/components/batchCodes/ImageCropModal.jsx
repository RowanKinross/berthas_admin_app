import React, { useRef, useState, useEffect } from 'react';

const ImageCropModal = ({ 
  showImageCrop, 
  cropImageSrc, 
  crop, 
  setCrop, 
  completedCrop, 
  setCompletedCrop, 
  rotation, 
  setRotation, 
  uploadingPhoto, 
  onCancel, 
  onUpload 
}) => {
  const imageRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragMode, setDragMode] = useState(''); // 'move', 'nw', 'ne', 'sw', 'se', 'create'
  const [originalCrop, setOriginalCrop] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Draw the crop overlay
  const drawCropOverlay = () => {
    if (!canvasRef.current || !imageRef.current || !imageLoaded) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!crop || !crop.width || !crop.height) return;

    // Draw semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Clear the crop area (make it transparent)
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(crop.x, crop.y, crop.width, crop.height);

    // Draw crop border
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(crop.x, crop.y, crop.width, crop.height);

    // Draw corner handles (larger, easier to grab)
    const handleSize = 16;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    
    // Top-left
    ctx.fillRect(crop.x - handleSize/2, crop.y - handleSize/2, handleSize, handleSize);
    ctx.strokeRect(crop.x - handleSize/2, crop.y - handleSize/2, handleSize, handleSize);
    
    // Top-right
    ctx.fillRect(crop.x + crop.width - handleSize/2, crop.y - handleSize/2, handleSize, handleSize);
    ctx.strokeRect(crop.x + crop.width - handleSize/2, crop.y - handleSize/2, handleSize, handleSize);
    
    // Bottom-left
    ctx.fillRect(crop.x - handleSize/2, crop.y + crop.height - handleSize/2, handleSize, handleSize);
    ctx.strokeRect(crop.x - handleSize/2, crop.y + crop.height - handleSize/2, handleSize, handleSize);
    
    // Bottom-right
    ctx.fillRect(crop.x + crop.width - handleSize/2, crop.y + crop.height - handleSize/2, handleSize, handleSize);
    ctx.strokeRect(crop.x + crop.width - handleSize/2, crop.y + crop.height - handleSize/2, handleSize, handleSize);

    // Add center move indicator
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('⬖', crop.x + crop.width/2, crop.y + crop.height/2 + 4);
  };

  // Get mouse/touch position relative to image
  const getEventPos = (e) => {
    const rect = imageRef.current.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX);
    const clientY = e.clientY || (e.touches && e.touches[0]?.clientY);
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  // Detect what was clicked (handle, crop area, or empty space)
  const getClickTarget = (pos) => {
    if (!crop) return 'create';

    const handleSize = 16;
    const tolerance = handleSize / 2;

    // Check corner handles
    if (Math.abs(pos.x - crop.x) <= tolerance && Math.abs(pos.y - crop.y) <= tolerance) return 'nw';
    if (Math.abs(pos.x - (crop.x + crop.width)) <= tolerance && Math.abs(pos.y - crop.y) <= tolerance) return 'ne';
    if (Math.abs(pos.x - crop.x) <= tolerance && Math.abs(pos.y - (crop.y + crop.height)) <= tolerance) return 'sw';
    if (Math.abs(pos.x - (crop.x + crop.width)) <= tolerance && Math.abs(pos.y - (crop.y + crop.height)) <= tolerance) return 'se';

    // Check if inside crop area (for moving)
    if (pos.x >= crop.x && pos.x <= crop.x + crop.width && 
        pos.y >= crop.y && pos.y <= crop.y + crop.height) return 'move';

    // Otherwise, create new crop
    return 'create';
  };

  // Get cursor style based on position
  const getCursorStyle = (pos) => {
    const target = getClickTarget(pos);
    switch (target) {
      case 'nw':
      case 'se':
        return 'nw-resize';
      case 'ne':
      case 'sw':
        return 'ne-resize';
      case 'move':
        return 'move';
      default:
        return 'crosshair';
    }
  };

  // Handle drag start
  const handleDragStart = (e) => {
    e.preventDefault();
    if (!imageRef.current) return;

    const pos = getEventPos(e);
    const target = getClickTarget(pos);
    
    setIsDragging(true);
    setDragStart(pos);
    setDragMode(target);
    setOriginalCrop(crop ? { ...crop } : null);
  };

  // Handle drag move
  const handleDragMove = (e) => {
    if (!isDragging || !imageRef.current) return;

    const pos = getEventPos(e);
    const img = imageRef.current;
    const deltaX = pos.x - dragStart.x;
    const deltaY = pos.y - dragStart.y;

    let newCrop = { ...crop };

    switch (dragMode) {
      case 'create':
        // Creating new crop
        const width = Math.abs(pos.x - dragStart.x);
        const height = width / 3; // 3:1 aspect ratio
        
        newCrop = {
          x: Math.min(dragStart.x, pos.x),
          y: Math.min(dragStart.y, pos.y),
          width: Math.min(width, img.offsetWidth - Math.min(dragStart.x, pos.x)),
          height: Math.min(height, img.offsetHeight - Math.min(dragStart.y, pos.y))
        };
        
        // Maintain aspect ratio
        if (newCrop.height * 3 > newCrop.width) {
          newCrop.height = newCrop.width / 3;
        } else {
          newCrop.width = newCrop.height * 3;
        }
        break;

      case 'move':
        // Moving entire crop
        if (!originalCrop) break;
        newCrop = {
          x: Math.max(0, Math.min(img.offsetWidth - originalCrop.width, originalCrop.x + deltaX)),
          y: Math.max(0, Math.min(img.offsetHeight - originalCrop.height, originalCrop.y + deltaY)),
          width: originalCrop.width,
          height: originalCrop.height
        };
        break;

      case 'nw':
        // Top-left corner
        if (!originalCrop) break;
        const newX = Math.max(0, Math.min(originalCrop.x + originalCrop.width - 30, originalCrop.x + deltaX));
        const newY = Math.max(0, Math.min(originalCrop.y + originalCrop.height - 10, originalCrop.y + deltaY));
        const newWidth = originalCrop.x + originalCrop.width - newX;
        const newHeight = newWidth / 3;
        
        newCrop = {
          x: newX,
          y: Math.max(0, originalCrop.y + originalCrop.height - newHeight),
          width: newWidth,
          height: newHeight
        };
        break;

      case 'ne':
        // Top-right corner
        if (!originalCrop) break;
        const neWidth = Math.max(30, Math.min(img.offsetWidth - originalCrop.x, originalCrop.width + deltaX));
        const neHeight = neWidth / 3;
        
        newCrop = {
          x: originalCrop.x,
          y: Math.max(0, originalCrop.y + originalCrop.height - neHeight),
          width: neWidth,
          height: neHeight
        };
        break;

      case 'sw':
        // Bottom-left corner
        if (!originalCrop) break;
        const swX = Math.max(0, Math.min(originalCrop.x + originalCrop.width - 30, originalCrop.x + deltaX));
        const swWidth = originalCrop.x + originalCrop.width - swX;
        const swHeight = swWidth / 3;
        
        newCrop = {
          x: swX,
          y: originalCrop.y,
          width: swWidth,
          height: Math.min(swHeight, img.offsetHeight - originalCrop.y)
        };
        break;

      case 'se':
        // Bottom-right corner
        if (!originalCrop) break;
        const seWidth = Math.max(30, Math.min(img.offsetWidth - originalCrop.x, originalCrop.width + deltaX));
        const seHeight = seWidth / 3;
        
        newCrop = {
          x: originalCrop.x,
          y: originalCrop.y,
          width: seWidth,
          height: Math.min(seHeight, img.offsetHeight - originalCrop.y)
        };
        break;
    }

    // Ensure crop stays within image bounds
    if (newCrop.x + newCrop.width > img.offsetWidth) {
      newCrop.width = img.offsetWidth - newCrop.x;
      newCrop.height = newCrop.width / 3;
    }
    if (newCrop.y + newCrop.height > img.offsetHeight) {
      newCrop.height = img.offsetHeight - newCrop.y;
      newCrop.width = newCrop.height * 3;
    }

    setCrop(newCrop);
    setCompletedCrop(newCrop);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setIsDragging(false);
    setDragMode('');
    setOriginalCrop(null);
  };

  // Handle mouse move for cursor changes
  const handleMouseMove = (e) => {
    if (!isDragging && imageRef.current) {
      const pos = getEventPos(e);
      const cursor = getCursorStyle(pos);
      imageRef.current.style.cursor = cursor;
    }
  };

  // Setup canvas and default crop on image load
  const handleImageLoad = () => {
    setImageLoaded(true);
    
    if (imageRef.current && canvasRef.current) {
      const img = imageRef.current;
      const canvas = canvasRef.current;
      
      // Set canvas size to match image
      canvas.width = img.offsetWidth;
      canvas.height = img.offsetHeight;

      // Set default crop (full width, 3:1 aspect ratio, centered)
      const cropWidth = img.offsetWidth * 0.8;
      const cropHeight = cropWidth / 3;
      const finalHeight = Math.min(cropHeight, img.offsetHeight * 0.8);
      const finalWidth = finalHeight * 3;
      
      const defaultCrop = {
        x: (img.offsetWidth - finalWidth) / 2,
        y: (img.offsetHeight - finalHeight) / 2,
        width: finalWidth,
        height: finalHeight
      };

      setCrop(defaultCrop);
      setCompletedCrop(defaultCrop);
    }
  };

  // Update canvas size when image changes
  useEffect(() => {
    if (imageLoaded && imageRef.current && canvasRef.current) {
      const img = imageRef.current;
      const canvas = canvasRef.current;
      canvas.width = img.offsetWidth;
      canvas.height = img.offsetHeight;
    }
  }, [imageLoaded, rotation]);

  // Redraw overlay when crop changes
  useEffect(() => {
    drawCropOverlay();
  }, [crop, imageLoaded]);

  // Add event listeners
  useEffect(() => {
    const handleGlobalMouseMove = (e) => handleDragMove(e);
    const handleGlobalMouseUp = () => handleDragEnd();

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.addEventListener('touchmove', handleGlobalMouseMove);
      document.addEventListener('touchend', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('touchmove', handleGlobalMouseMove);
      document.removeEventListener('touchend', handleGlobalMouseUp);
    };
  }, [isDragging, dragStart, dragMode, originalCrop]);


  return (
    <>
      {showImageCrop && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="modal-content" style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '20px',
            maxWidth: '90vw',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{ marginBottom: '15px' }}>
              <h3>Crop & Rotate Photo</h3>
              <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
                Drag corners to resize • Click inside crop area to move • Click outside to create new crop
              </p>
              <div style={{ marginBottom: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  className="button"
                  onClick={() => setRotation(r => r - 90)}
                  style={{ fontSize: '12px', padding: '5px 10px' }}
                >
                  Rotate ↺
                </button>
                <button
                  className="button"
                  onClick={() => setRotation(r => r + 90)}
                  style={{ fontSize: '12px', padding: '5px 10px' }}
                >
                  Rotate ↻
                </button>
                <span style={{ fontSize: '12px', color: '#666' }}>
                  Rotation: {rotation}°
                </span>
              </div>
            </div>

            <div 
              ref={containerRef}
              style={{ 
                position: 'relative', 
                display: 'inline-block',
                maxWidth: '100%'
              }}
            >
              <img
                ref={imageRef}
                src={cropImageSrc}
                style={{
                  transform: `rotate(${rotation}deg)`,
                  maxWidth: '500px',
                  maxHeight: '400px',
                  width: 'auto',
                  height: 'auto',
                  display: 'block'
                }}
                onLoad={handleImageLoad}
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
                onMouseMove={handleMouseMove}
                draggable={false}
              />
              <canvas
                ref={canvasRef}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  pointerEvents: 'none'
                }}
              />
            </div>

            <div style={{ marginTop: '15px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                className="button button-secondary"
                onClick={onCancel}
                disabled={uploadingPhoto}
              >
                Cancel
              </button>
              <button
                className="button"
                onClick={() => onUpload(imageRef.current)}
                disabled={!completedCrop || uploadingPhoto}
              >
                {uploadingPhoto ? "Uploading..." : "Upload Photo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ImageCropModal;