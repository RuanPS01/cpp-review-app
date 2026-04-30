#include <iostream>
using namespace std;

int main ()
{
    int num;
    int n;
    int contador = 0;
    
    cin >> n;
    
    for ( int i = 0; i < n; i++ ){
        cin >> num;
        
        if ( num % 3 == 0 ){
            contador++;
        }
    }
    
    cout << contador << endl;
    
    return 0;
}