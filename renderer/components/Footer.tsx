import React from 'react';

interface FooterProps {
    actions?: React.ReactNode;
}

const Footer: React.FC<FooterProps> = ({ actions }) => {
    return (
        <footer style={{ textAlign: 'center', padding: '10px', borderTop: '1px solid #ccc' }}>
            {actions ? (
                <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                    {actions}
                </div>
            ) : null}
        </footer>
    );
};

export default Footer;