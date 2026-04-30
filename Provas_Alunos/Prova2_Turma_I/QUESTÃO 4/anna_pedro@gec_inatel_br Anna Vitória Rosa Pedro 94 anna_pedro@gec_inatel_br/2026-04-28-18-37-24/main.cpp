#include <iostream>
using namespace std;

int main()
{
    int n;
    cin >> n; 
    
    int id[10];
    int pago = 0;
    
    for ( int i = 0; i < n; i++ ){
        cin >> id[i];
        cin >> pago;
        
        if ( id[i] == pago ){
            id[i] == -1;
        }
        
    }

    cout << id[10] << endl;
    
    return 0;
}