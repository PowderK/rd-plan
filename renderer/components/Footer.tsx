import React from 'react';

interface FooterProps {
    actions?: React.ReactNode;
}

const Footer: React.FC<FooterProps> = ({ actions }) => {
    if (!actions) return null;
    
    return (
        <footer style={{ textAlign: 'center', padding: '10px', borderTop: '1px solid #ccc' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                {actions}
            </div>
        </footer>
    );
};

export default Footer;