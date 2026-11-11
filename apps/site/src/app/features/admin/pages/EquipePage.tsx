import { useState } from 'react';
import { InviteModal } from '../components/InviteModal.tsx';

/** Equipe interna: convite de engenheiros e administradores. */
export function EquipePage() {
  const [inviting, setInviting] = useState(false);
  return (
    <>
      <h1 className="app-h">Equipe</h1>
      <p className="app-sub">Convide engenheiros e administradores. O convite chega por e-mail com o link para criar a senha.</p>
      <button type="button" className="b-sm solid" onClick={() => setInviting(true)}>
        Convidar pessoa
      </button>
      {inviting ? <InviteModal onClose={() => setInviting(false)} /> : null}
    </>
  );
}
