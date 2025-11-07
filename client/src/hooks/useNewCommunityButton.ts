import { useNavigate } from 'react-router-dom';

const useNewCommunityButton = () => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/new/community');
  };

  return { handleClick };
};

export default useNewCommunityButton;
