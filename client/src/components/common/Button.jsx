const Button = ({
  children,
  variant = 'primary',
  type = 'button',
  className = '',
  disabled,
  loading,
  onClick,
  ...props
}) => {
  return (
    <button
      type={type}
      className={`btn btn-${variant} ${className}`}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading ? 'Please wait...' : children}
    </button>
  );
};

export default Button;
