import { useState } from "react";

interface UserCardProps {
  name: string;
  role: string;
}

function UserCard({ name, role }: UserCardProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    throw new Error("UserCard encountered an error!");
  }

  return (
    <div className="user-card">
      <div className="user-avatar">{name.charAt(0)}</div>
      <h4>{name}</h4>
      <p>{role}</p>
      <button onClick={() => setHasError(true)}>Trigger Error</button>
    </div>
  );
}

export default UserCard;
