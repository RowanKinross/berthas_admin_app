import React, { useRef } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

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

            <ReactCrop
              crop={crop}
              onChange={(newCrop) => setCrop(newCrop)}
              onComplete={(newCrop) => setCompletedCrop(newCrop)}
              aspect={3}
              style={{ maxWidth: '500px', maxHeight: '250px' }}
            >
              <img
                ref={imageRef}
                src={cropImageSrc}
                style={{
                  transform: `rotate(${rotation}deg)`,
                  maxWidth: '100%',
                  maxHeight: '250px'
                }}
                onLoad={() => {
                  if (imageRef.current) {
                    const { naturalWidth, naturalHeight, width, height } = imageRef.current;
                    // Use the displayed image dimensions
                    const imgWidth = width;
                    const imgHeight = height;
                    
                    if (imgWidth && imgHeight) {
                      // Calculate maximum crop size that fits the image with 3:1 aspect ratio
                      let cropWidth, cropHeight;
                      
                      // Try to use full width first
                      cropWidth = imgWidth;
                      cropHeight = cropWidth / 3;
                      
                      // If height is too big, use full height and adjust width
                      if (cropHeight > imgHeight) {
                        cropHeight = imgHeight;
                        cropWidth = cropHeight * 3;
                      }
                      
                      // Center the crop
                      const cropX = (imgWidth - cropWidth) / 2;
                      const cropY = (imgHeight - cropHeight) / 2;
                      
                      setCrop({
                        unit: 'px',
                        width: Math.round(cropWidth),
                        height: Math.round(cropHeight),
                        x: Math.round(cropX),
                        y: Math.round(cropY)
                      });
                      
                      // Also set completedCrop so the upload button is immediately enabled
                      setCompletedCrop({
                        unit: 'px',
                        width: Math.round(cropWidth),
                        height: Math.round(cropHeight),
                        x: Math.round(cropX),
                        y: Math.round(cropY)
                      });
                    }
                  }
                }}
              />
            </ReactCrop>

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