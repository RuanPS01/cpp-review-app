#include <iostream>
#include <iomanip>
using namespace std;

int main()
{
    int n;
    double altura;
    double maior = 0;
    double menor = 0;
    
    cin >> n;
    
    for ( int i = 0; i < n; i++ ){
        cin >> altura;
        
        if ( altura > maior ){
            maior = altura;
        }
        else if ( altura > menor && maior > menor ){
            menor = altura;
            if ( altura > menor && maior > menor ){
                menor = altura;
            }
        }
    }
    
    cout << fixed << setprecision(2);
    cout << "Menor altura: " << menor << endl;
    cout << "Maior altura: " << maior << endl;
    
    return 0;
}