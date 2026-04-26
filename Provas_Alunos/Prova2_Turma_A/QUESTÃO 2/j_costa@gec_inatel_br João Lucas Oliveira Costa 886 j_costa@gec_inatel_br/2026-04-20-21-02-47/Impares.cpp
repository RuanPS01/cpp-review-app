#include <iostream>
using namespace std;

int main()
{
    int X;
    cin >> X;
    
    int nImpar = 0;
    
    X = X % 2 != 0;
    
    for ( int i = 0; i < X; i++ ) {
        if ( X % 2 != 0 ) {
           cout << X;
        }
    }
        
    
    return 0;
}