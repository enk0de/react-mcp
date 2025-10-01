interface UserCardProps {
  name: string;
  role: string;
}

function UserCard({ name, role }: UserCardProps) {
  return (
    <div className="user-card">
      <div className="user-avatar">
        {name.charAt(0)}
      </div>
      <h4>{name}</h4>
      <p>{role}</p>
    </div>
  );
}

export default UserCard;