interface UserCardProps {
  name: string;
  role: string;
  avatarColor?: string;
}

function UserCard({ name, role, avatarColor = '#667eea' }: UserCardProps) {
  return (
    <div className="user-card">
      <div className="user-avatar" style={{ backgroundColor: avatarColor }}>
        {name.charAt(0)}
      </div>
      <h4>{name}</h4>
      <p>{role}</p>
    </div>
  );
}

export default UserCard;
