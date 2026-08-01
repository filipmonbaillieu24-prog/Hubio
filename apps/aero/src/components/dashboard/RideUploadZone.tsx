import React, { useRef, useState } from 'react';

interface RideUploadZoneProps {
  uploading: boolean;
  uploadMsg: string | null;
  ridesCount: number;
  onHandleFiles: (files: FileList) => void;
}

export const RideUploadZone: React.FC<RideUploadZoneProps> = ({
  uploading,
  uploadMsg,
  ridesCount,
  onHandleFiles,
}) => {
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <div
        className={`wd-upload-zone ${dragOver ? 'wd-upload-zone--over' : ''} ${uploading ? 'wd-upload-zone--loading' : ''} ${!uploading && ridesCount === 0 ? 'wd-upload-zone--empty' : ''}`}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) onHandleFiles(e.dataTransfer.files);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".fit,.gpx,.tcx"
          hidden
          onChange={(e) => e.target.files && onHandleFiles(e.target.files)}
        />
        {uploading ? (
          <>
            <span className="wd-spinner" /> Bezig…
          </>
        ) : ridesCount === 0 ? (
          <>
            <span className="wd-upload-icon">📁</span>
            <span style={{ fontWeight: 600 }}>Sleep FIT / GPX / TCX hier</span>
            <span style={{ fontSize: 11, color: '#667' }}>of klik om te kiezen</span>
          </>
        ) : (
          <>
            <span className="wd-upload-icon">📁</span>
            <span>FIT / GPX / TCX</span>
          </>
        )}
      </div>
      {uploadMsg && <div className="wd-upload-msg">{uploadMsg}</div>}
    </>
  );
};
