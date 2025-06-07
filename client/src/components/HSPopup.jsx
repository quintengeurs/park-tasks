import { Dialog } from '@headlessui/react';

export default function HSPopup({ isOpen, onClose }) {
  return (
    <Dialog open={isOpen} onClose={() => {}} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-md p-6 bg-white rounded-lg">
          <Dialog.Title className="text-lg font-bold">Health & Safety</Dialog.Title>
          <p>Please review the Park Operations H&S Document.</p>
          <a
            href="/uploads/hs-document.pdf" // Served from backend
            target="_blank"
            className="text-blue-500 underline"
          >
            View H&S Document
          </a>
          <button
            onClick={onClose}
            className="mt-4 p-2 bg-blue-500 text-white rounded"
          >
            Reviewed
          </button>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}