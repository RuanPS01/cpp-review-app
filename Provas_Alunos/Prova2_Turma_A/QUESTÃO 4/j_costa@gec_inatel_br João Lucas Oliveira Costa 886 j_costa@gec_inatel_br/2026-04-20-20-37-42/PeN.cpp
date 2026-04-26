#include <iostream>
#include <iomanip>
#include <cstring>
using namespace std;

int main ()
{
    int n;
    cin >> n;
    
    int soma = 0;
    int mpositiva, mnegativa;
    
    for ( int i = 0; i < n; i++ ) {
        cin >> n;
        if ( i == 0 ) {
            break;
        } else {
            n += soma;
        }
    }
    
    int opcao;
    
    for ( int i = 0; i < n; i++ ) {
        if ( opcao = 'positivos' ) {
            positivos = mpositiva;
        }
        else if ( opcao = 'negativos' ) {
            negativos = mnegativa;
        }
    }
    
    double media = soma / n;
    
    cout << fixed << setprecision(3);
    cout << "media = " << media << mpositiva << endl;
    cout << "media = -" << media << mnegativa << endl;
    
    return 0;
}