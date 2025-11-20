import './index.css';
import { OrderType } from '../../../../../types/types';
import { orderTypeDisplayName } from '../../../../../types/constants';

interface OrderButtonProps {
  orderType: OrderType;
  setQuestionOrder: (order: OrderType) => void;
  isActive?: boolean;
}

const OrderButton = ({ orderType, setQuestionOrder, isActive = false }: OrderButtonProps) => (
  <button
    className={`btn ${isActive ? 'active' : ''}`}
    onClick={() => {
      setQuestionOrder(orderType);
    }}>
    {orderTypeDisplayName[orderType]}
  </button>
);

export default OrderButton;
