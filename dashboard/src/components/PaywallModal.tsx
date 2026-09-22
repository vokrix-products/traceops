import { PRODUCT } from '../lib/product';
import Modal from './Modal';

interface PaywallProps {
  onClose: () => void;
  onUpgrade: () => void;
}

export function PaywallModal({ onClose, onUpgrade }: PaywallProps) {
  return (
    <Modal
      title={PRODUCT.paywallTitle}
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>
            Not now
          </button>
          <button className="btn btn-primary" onClick={onUpgrade}>
            Upgrade
          </button>
        </>
      }
    >
      {PRODUCT.paywallDescription}
      <div className="banner info">
        You have reached the free tier of {PRODUCT.name}. Unlimited Controls,
        approvals, and audit history are available on the paid plan.
      </div>
    </Modal>
  );
}

export default PaywallModal;
