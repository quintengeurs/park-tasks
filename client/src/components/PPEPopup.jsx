import { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';

export default function PPEPopup({ isOpen, onClose }) {
  const [selectedPPE, setSelectedPPE] = useState([]);
  const ppeItems = ['Gloves', 'Boots', 'Helmet', 'Vest'];

  const mutation = useMutation({
    mutationFn: (items) =>
      axios.post(
        '/api/ppe',
        { items, userId: 'current-user' }, // Replace with actual user ID from context or token
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      ),
    onSuccess: () => onClose(),
  });

  return (
    <Dialog open={isOpen} onClose={() => {}} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-md p-6 bg-white rounded-lg">
          <Dialog.Title className="text-lg font-bold">PPE Check</Dialog.Title>
          {ppeItems.map((item) => (
            <label key={item} className="block">
              <input
                type="checkbox"
                checked={selectedPPE.includes(item)}
                onChange={() =>
                  setSelectedPPE((prev) =>
                    prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
                  )
                }
              />
              {item}
            </label>
          ))}
          <button
            onClick={() => mutation.mutate(selectedPPE)}
            className="mt-4 p-2 bg-blue-500 text-white rounded"
          >
            Request Additional PPE
          </button>
          <button
            onClick={onClose}
            className="mt-2 p-2 bg-gray-300 rounded"
          >
            Continue
          </button>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}