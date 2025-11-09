'use client';

import React from 'react';
import { useModal } from '../contexts/ModalContext';
import { VideoModal } from './VideoModal';
import { Video } from '../types/data';

export function ModalRenderer() {
  const { modalType, modalData, closeModal } = useModal();

  // Render nothing if no modal is open
  if (!modalType || !modalData) {
    return null;
  }

  // Render video preview modal
  if (modalType === 'video-preview' && modalData) {
    return <VideoModal video={modalData as Video} onClose={closeModal} />;
  }

  // Future modal types can be added here
  // if (modalType === 'upload') {
  //   return <UploadModal data={modalData} onClose={closeModal} />;
  // }

  return null;
}


