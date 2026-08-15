import { useState, useRef, useEffect } from 'react';
import Modal from './Modal.jsx';
import { Btn } from '../../md.jsx';

/** Returns [handleClose, UnsavedModal] — call handleClose instead of onClose; render <UnsavedModal/> anywhere in JSX */
export function useUnsavedGuard(onClose) {
  const isDirty = useRef(false);
  const [show, setShow] = useState(false);

  const markDirty = () => { isDirty.current = true; };
  const markClean = () => { isDirty.current = false; };

  const handleClose = () => {
    if (isDirty.current) { setShow(true); return; }
    onClose();
  };

  const UnsavedModal = show ? (
    <Modal title="Unsaved Changes" onClose={() => setShow(false)}
      footer={<>
        <Btn className="btn btn-secondary" onClick={() => setShow(false)}>Keep editing</Btn>
        <Btn className="btn btn-danger-strong" onClick={() => { setShow(false); onClose(); }}>Discard &amp; close</Btn>
      </>}>
      <p style={{ margin: 0, color: 'var(--text1)' }}>You have unsaved changes. Are you sure you want to close without saving?</p>
    </Modal>
  ) : null;

  return { handleClose, markDirty, markClean, UnsavedModal };
}
